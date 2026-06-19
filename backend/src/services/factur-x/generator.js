import { createRequire } from 'node:module';
import PDFKitDocument from 'pdfkit';
import {
  AFRelationship,
  PDFDocument as PdfLibDocument,
  PDFName
} from 'pdf-lib';
import {
  FACTUR_X_CONFORMANCE_LEVEL,
  FACTUR_X_PROFILE_ID,
  FACTUR_X_XML_FILENAME,
  FACTUR_X_XML_MIME_TYPE,
  FacturXGenerationError,
  formatMoney,
  normalizeBillToFacturXData
} from './invoice-data.js';
import { validateFacturXDocument } from './validation.js';

const require = createRequire(import.meta.url);

export function getFacturXPackageInfo() {
  const packageJsonPath = require.resolve('factur-x/package.json');
  return require(packageJsonPath);
}

function appendText(doc, label, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(String(value));
}

function collectPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

export async function renderFacturXReadablePdf(invoice) {
  const doc = new PDFKitDocument({ size: 'A4', margin: 48, autoFirstPage: true, pdfVersion: '1.7' });
  doc.info.Title = invoice.title;
  doc.info.Author = 'Rungis Portal';
  doc.font('Helvetica-Bold').fontSize(18).text(invoice.title);
  doc.moveDown(0.5);
  appendText(doc, 'Factur-X profile', invoice.profile);
  appendText(doc, 'Bill ID', invoice.invoiceId);
  appendText(doc, 'Issue date', invoice.issueDate);
  appendText(doc, 'Delivery date', invoice.deliveryDate);
  appendText(doc, 'Currency', invoice.currency);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text('Seller');
  doc.fontSize(10);
  appendText(doc, 'Organisation', invoice.seller.name);
  appendText(doc, 'SIRET', invoice.seller.legalRegistrationId);
  appendText(doc, 'VAT ID', invoice.seller.taxRegistrationId);
  appendText(doc, 'Address', invoice.seller.postalAddress.lineOne);
  appendText(doc, 'Zipcode', invoice.seller.postalAddress.postCode);
  appendText(doc, 'City', invoice.seller.postalAddress.city);
  appendText(doc, 'Country', invoice.seller.postalAddress.countryCode);
  if (invoice.includedNotes.length > 0) {
    appendText(doc, 'Bill mentions', invoice.includedNotes.join(' | '));
  }
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(13).text('Buyer');
  doc.fontSize(10);
  appendText(doc, 'Organisation', invoice.buyer.name);
  appendText(doc, 'SIRET', invoice.buyer.legalRegistrationId);
  appendText(doc, 'Address', invoice.buyer.postalAddress.lineOne);
  appendText(doc, 'Zipcode', invoice.buyer.postalAddress.postCode);
  appendText(doc, 'City', invoice.buyer.postalAddress.city);
  appendText(doc, 'Country', invoice.buyer.postalAddress.countryCode);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(12).text('Lines');
  doc.fontSize(9);
  for (const line of invoice.lines) {
    doc.font('Helvetica-Bold').text(`${line.id}. ${line.name}`, { continued: true });
    doc.font('Helvetica').text(` | ${line.quantity} ${line.unitCode} x ${formatMoney(line.unitPrice)} = ${formatMoney(line.lineTotal)} ${invoice.currency}`);
    appendText(doc, 'VAT', `${line.vatCategory} ${line.vatRate}%${line.vatExemptionReason ? ` ${line.vatExemptionReason}` : ''}`);
    if (line.description) {
      appendText(doc, 'Reference', line.description);
    }
  }
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(12).text('VAT breakdown');
  doc.font('Helvetica').fontSize(9);
  for (const vat of invoice.vatBreakdowns) {
    doc.text(`${vat.category} ${vat.rate}% basis ${formatMoney(vat.taxableAmount)} tax ${formatMoney(vat.taxAmount)}${vat.exemptionReason ? ` ${vat.exemptionReason}` : ''}`);
  }
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(12).text('Totals');
  doc.font('Helvetica').fontSize(10);
  appendText(doc, 'Line net amount', `${formatMoney(invoice.totals.lineNetAmount)} ${invoice.currency}`);
  appendText(doc, 'Tax basis', `${formatMoney(invoice.totals.taxBasisAmount)} ${invoice.currency}`);
  appendText(doc, 'Tax total', `${formatMoney(invoice.totals.taxTotalAmount)} ${invoice.currency}`);
  appendText(doc, 'Grand total', `${formatMoney(invoice.totals.grandTotalAmount)} ${invoice.currency}`);
  appendText(doc, 'Amount due', `${formatMoney(invoice.totals.amountDue)} ${invoice.currency}`);
  doc.moveDown();
  doc.fontSize(8).text(`${FACTUR_X_XML_FILENAME} (${FACTUR_X_XML_MIME_TYPE}) is embedded as the structured invoice source.`);
  return collectPdfBuffer(doc);
}

function x(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function partyXml(tag, party) {
  return `
        <ram:${tag}>
          <ram:ID>${x(party.legalRegistrationId)}</ram:ID>
          <ram:Name>${x(party.name)}</ram:Name>
          <ram:PostalTradeAddress>
            <ram:PostcodeCode>${x(party.postalAddress.postCode)}</ram:PostcodeCode>
            <ram:LineOne>${x(party.postalAddress.lineOne)}</ram:LineOne>
            <ram:CityName>${x(party.postalAddress.city)}</ram:CityName>
            <ram:CountryID>${x(party.postalAddress.countryCode)}</ram:CountryID>
          </ram:PostalTradeAddress>
          <ram:SpecifiedLegalOrganization>
            <ram:ID schemeID="${x(party.legalRegistrationScheme)}">${x(party.legalRegistrationId)}</ram:ID>
          </ram:SpecifiedLegalOrganization>
          ${party.taxRegistrationId ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(party.taxRegistrationId)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
        </ram:${tag}>`;
}

export function buildFacturXXml(invoice) {
  const lineXml = invoice.lines.map((line) => `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument><ram:LineID>${x(line.id)}</ram:LineID></ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:SellerAssignedID>${x(line.sourceId)}</ram:SellerAssignedID>
          <ram:Name>${x(line.name)}</ram:Name>
          ${line.description ? `<ram:Description>${x(line.description)}</ram:Description>` : ''}
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice><ram:ChargeAmount>${formatMoney(line.unitPrice)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${x(line.unitCode)}">${x(line.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>${x(line.vatCategory)}</ram:CategoryCode>
            <ram:RateApplicablePercent>${x(line.vatRate)}</ram:RateApplicablePercent>
            ${line.vatExemptionReason ? `<ram:ExemptionReason>${x(line.vatExemptionReason)}</ram:ExemptionReason>` : ''}
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${formatMoney(line.lineTotal)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`).join('');

  const vatXml = invoice.vatBreakdowns.map((vat) => `
          <ram:ApplicableTradeTax>
            <ram:CalculatedAmount>${formatMoney(vat.taxAmount)}</ram:CalculatedAmount>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:BasisAmount>${formatMoney(vat.taxableAmount)}</ram:BasisAmount>
            <ram:CategoryCode>${x(vat.category)}</ram:CategoryCode>
            <ram:RateApplicablePercent>${x(vat.rate)}</ram:RateApplicablePercent>
            ${vat.exemptionReason ? `<ram:ExemptionReason>${x(vat.exemptionReason)}</ram:ExemptionReason>` : ''}
          </ram:ApplicableTradeTax>`).join('');

  const notesXml = invoice.includedNotes.map((note) => `
    <ram:IncludedNote><ram:Content>${x(note)}</ram:Content></ram:IncludedNote>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>A1</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${x(FACTUR_X_PROFILE_ID)}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${x(invoice.invoiceId)}</ram:ID>
    <ram:TypeCode>${x(invoice.typeCode)}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${x(invoice.issueDate)}</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote><ram:Content>${x(FACTUR_X_XML_FILENAME)}; ${x(FACTUR_X_XML_MIME_TYPE)}; ${x(FACTUR_X_CONFORMANCE_LEVEL)}</ram:Content></ram:IncludedNote>${notesXml}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${x(invoice.billKey || invoice.role || 'Rungis')}</ram:BuyerReference>${partyXml('SellerTradeParty', invoice.seller)}${partyXml('BuyerTradeParty', invoice.buyer)}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${x(invoice.deliveryDate)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${x(invoice.currency)}</ram:InvoiceCurrencyCode>${vatXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatMoney(invoice.totals.lineNetAmount)}</ram:LineTotalAmount>
        <ram:AllowanceTotalAmount>${formatMoney(invoice.totals.allowanceTotalAmount)}</ram:AllowanceTotalAmount>
        <ram:ChargeTotalAmount>${formatMoney(invoice.totals.chargeTotalAmount)}</ram:ChargeTotalAmount>
        <ram:TaxBasisTotalAmount>${formatMoney(invoice.totals.taxBasisAmount)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${x(invoice.currency)}">${formatMoney(invoice.totals.taxTotalAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatMoney(invoice.totals.grandTotalAmount)}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>${formatMoney(invoice.totals.prepaidAmount)}</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>${formatMoney(invoice.totals.amountDue)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

function buildFacturXXmp() {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${FACTUR_X_XML_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${FACTUR_X_CONFORMANCE_LEVEL}</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function embedFacturXXmlInPdfA3(pdfBytes, xml) {
  const pdf = await PdfLibDocument.load(pdfBytes);
  await pdf.attach(Buffer.from(xml, 'utf8'), FACTUR_X_XML_FILENAME, {
    mimeType: FACTUR_X_XML_MIME_TYPE,
    description: 'Factur-X structured invoice XML',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Source
  });
  const metadataRef = pdf.context.register(
    pdf.context.stream(buildFacturXXmp(), {
      Type: 'Metadata',
      Subtype: 'XML'
    })
  );
  pdf.catalog.set(PDFName.of('Metadata'), metadataRef);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

export async function generateFacturXBill(input) {
  try {
    getFacturXPackageInfo();
    const invoice = normalizeBillToFacturXData(input);
    const xml = buildFacturXXml(invoice);
    const readablePdf = await renderFacturXReadablePdf(invoice);
    const pdfBytes = await embedFacturXXmlInPdfA3(readablePdf, xml);
    const validation = await validateFacturXDocument({ pdfBytes, xml, profile: invoice.profile });
    return { invoice, xml, pdfBytes, validation };
  } catch (error) {
    if (error instanceof FacturXGenerationError) {
      throw error;
    }
    throw new FacturXGenerationError('Factur-X generation failed.', {
      statusCode: 500,
      errorCode: 'generation_failed',
      details: [error instanceof Error ? error.message : 'Unknown generation error.']
    });
  }
}

export async function sendFacturXBill(reply, options) {
  const { pdfBytes } = await generateFacturXBill(options);
  reply
    .type('application/pdf')
    .header('Content-Disposition', `attachment; filename="${options.filename}"`)
    .header('Cache-Control', 'no-store')
    .send(pdfBytes);
}
