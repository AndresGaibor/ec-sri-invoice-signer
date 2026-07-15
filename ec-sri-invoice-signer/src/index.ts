import { signInvoiceXml, signDebitNoteXml, signCreditNoteXml, signDeliveryGuideXml, signWithholdingCertificateXml } from './signature/signature';
import { UnsuportedPkcs12Error, XmlFormatError, UnsupportedXmlFeatureError, UnsupportedDocumentTypeError } from './utils/errors';
import { createPreparedSigner, PreparedSigner } from './utils/cryptography-native';

export {
  signInvoiceXml,
  signDebitNoteXml,
  signCreditNoteXml,
  signDeliveryGuideXml,
  signWithholdingCertificateXml,
  createPreparedSigner,
  PreparedSigner,
  UnsuportedPkcs12Error,
  XmlFormatError,
  UnsupportedXmlFeatureError,
  UnsupportedDocumentTypeError
};
