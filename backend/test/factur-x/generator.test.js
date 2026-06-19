import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { extractFacturXXml } from '../../src/services/factur-x/validation.js';
import {
  buildFacturXXml,
  generateFacturXBill,
  getFacturXPackageInfo
} from '../../src/services/factur-x/generator.js';
import { normalizeBillToFacturXData } from '../../src/services/factur-x/invoice-data.js';

const fixtures = JSON.parse(await readFile(new URL('../../fixtures/factur-x/bills.fixture.json', import.meta.url), 'utf8'));

test('uses the mandatory factur-x npm package as an installed generation dependency', () => {
  const pkg = getFacturXPackageInfo();
  assert.equal(pkg.name, 'factur-x');
  assert.equal(pkg.version, '0.0.2');
});

test('builds Factur-X XML with profile, parties, lines, and MIME marker', () => {
  const invoice = normalizeBillToFacturXData({ role: 'vendor', title: 'Vendor Bill', ...fixtures.simple });
  const xml = buildFacturXXml(invoice);

  assert.match(xml, /<rsm:CrossIndustryInvoice/);
  assert.match(xml, /urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931/);
  assert.match(xml, /<ram:Name>Vendor SAS<\/ram:Name>/);
  assert.match(xml, /<ram:Name>Client SARL<\/ram:Name>/);
  assert.match(xml, /<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">FR12345678901<\/ram:ID><\/ram:SpecifiedTaxRegistration>/);
  assert.match(xml, /<ram:IncludedNote><ram:Content>Payment &lt;due&gt; &amp; &quot;safe&quot; within 30 days\.<\/ram:Content><\/ram:IncludedNote>/);
  assert.match(xml, /<ram:CategoryCode>S<\/ram:CategoryCode>/);
  assert.match(xml, /<ram:RateApplicablePercent>5.5<\/ram:RateApplicablePercent>/);
  assert.doesNotMatch(xml, /<ram:ExemptionReason>/);
  assert.match(xml, /<ram:LineTotalAmount>25.00<\/ram:LineTotalAmount>/);
  assert.match(xml, /<ram:DuePayableAmount>26.38<\/ram:DuePayableAmount>/);
  assert.match(xml, /factur-x.xml; text\/xml; EN 16931/);
});

test('generates a hybrid PDF with embedded factur-x.xml and XMP metadata', async () => {
  const result = await generateFacturXBill({ role: 'vendor', title: 'Vendor Bill', ...fixtures.simple });
  const pdfText = result.pdfBytes.toString('latin1');
  const embeddedXml = await extractFacturXXml(result.pdfBytes);

  assert.equal(result.validation.ok, true);
  assert.equal(embeddedXml, result.xml);
  assert.match(pdfText, /factur-x\.xml/);
  assert.match(pdfText, /\/AFRelationship \/Source/);
  assert.match(pdfText, /<fx:DocumentFileName>factur-x\.xml<\/fx:DocumentFileName>/);
  assert.match(pdfText, /<fx:ConformanceLevel>EN 16931<\/fx:ConformanceLevel>/);
});
