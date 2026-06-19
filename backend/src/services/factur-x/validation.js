import {
  FACTUR_X_CONFORMANCE_LEVEL,
  FACTUR_X_DOCUMENT_TYPE,
  FACTUR_X_XML_FILENAME,
  FACTUR_X_XML_MIME_TYPE,
  FacturXGenerationError
} from './invoice-data.js';
import {
  PDFDict,
  PDFDocument as PdfLibDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  PDFString,
  decodePDFRawStream
} from 'pdf-lib';

export const FACTUR_X_REQUIRED_XMP = Object.freeze({
  DocumentType: FACTUR_X_DOCUMENT_TYPE,
  DocumentFileName: FACTUR_X_XML_FILENAME,
  Version: '1.0',
  ConformanceLevel: FACTUR_X_CONFORMANCE_LEVEL
});

function pdfStringToText(value) {
  if (!value) {
    return '';
  }
  if (typeof value.decodeText === 'function') {
    return value.decodeText();
  }
  return value.toString().replace(/^\((.*)\)$/, '$1');
}

export async function extractFacturXXml(pdfBytes) {
  const pdf = await PdfLibDocument.load(pdfBytes);
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) {
      continue;
    }
    const fileName = pdfStringToText(object.lookupMaybe(PDFName.of('F'), PDFString));
    if (fileName !== FACTUR_X_XML_FILENAME) {
      continue;
    }
    const stream = object.lookup(PDFName.of('EF'), PDFDict).lookup(PDFName.of('F'), PDFStream);
    const raw = stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
    return Buffer.from(raw).toString('utf8');
  }
  throw new FacturXGenerationError('Generated PDF does not contain factur-x.xml.', {
    statusCode: 500,
    errorCode: 'validation_failed'
  });
}

export async function validateFacturXDocument({ pdfBytes, xml, profile = FACTUR_X_CONFORMANCE_LEVEL }) {
  const details = [];
  const pdfBuffer = Buffer.from(pdfBytes);
  const embeddedXml = await extractFacturXXml(pdfBuffer).catch((error) => {
    details.push(error.message);
    return '';
  });

  if (embeddedXml !== xml) {
    details.push('Embedded factur-x.xml does not match the generated XML.');
  }
  if (!xml.includes('<rsm:CrossIndustryInvoice')) {
    details.push('Factur-X XML root element is missing.');
  }
  if (!xml.includes(`<ram:ID>${FACTUR_X_XML_FILENAME}</ram:ID>`) && !xml.includes(FACTUR_X_XML_FILENAME)) {
    details.push('Factur-X XML filename marker is missing.');
  }
  if (!xml.includes(FACTUR_X_XML_MIME_TYPE)) {
    details.push('Factur-X XML MIME type marker is missing.');
  }
  for (const [key, value] of Object.entries(FACTUR_X_REQUIRED_XMP)) {
    if (!pdfBuffer.includes(Buffer.from(`<fx:${key}>${value}</fx:${key}>`, 'utf8'))) {
      details.push(`XMP fx:${key} is missing or invalid.`);
    }
  }
  if (!pdfBuffer.includes(Buffer.from('/AF', 'utf8'))) {
    details.push('PDF document-level associated file array is missing.');
  }
  if (!pdfBuffer.includes(Buffer.from(`/AFRelationship /Source`, 'utf8'))) {
    details.push('Embedded XML AFRelationship Source is missing.');
  }
  if (profile !== FACTUR_X_CONFORMANCE_LEVEL) {
    details.push('Unexpected Factur-X conformance profile.');
  }

  if (details.length > 0) {
    throw new FacturXGenerationError('Generated Factur-X document failed validation.', {
      statusCode: 500,
      errorCode: 'validation_failed',
      details
    });
  }

  return {
    ok: true,
    embeddedFilename: FACTUR_X_XML_FILENAME,
    embeddedMimeType: FACTUR_X_XML_MIME_TYPE,
    conformanceLevel: profile
  };
}
