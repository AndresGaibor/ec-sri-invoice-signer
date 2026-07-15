import { createHash, createPrivateKey, sign as cryptoSign, KeyObject } from 'node:crypto';
import * as forge from 'node-forge';
import { UnsuportedPkcs12Error } from './errors';

const sha1Base64 = (data: string): string => {
  return createHash('sha1').update(data, 'utf8').digest('base64');
};

const sha1Base64Binary = (data: string): string => {
  return createHash('sha1').update(data, 'latin1').digest('base64');
};

const signRsaSha1 = (data: string, privateKey: KeyObject): string => {
  return cryptoSign('RSA-SHA1', Buffer.from(data, 'utf8'), privateKey).toString('base64');
};

export type PreparedSigner = {
  sign: (data: string) => string;
  getHash: (data: string) => string;
  extractX509Data: () => {
    content: string;
    contentHash: string;
    issuerName: string;
    serialNumber: string;
  };
  extractPrivateKeyData: () => {
    modulus: string;
    exponent: string;
  };
};

const getBancoCentralPkcs12PrivateKey = (pkcs8ShroudedKeyBags: forge.pkcs12.Bag[]) => {
  const privateKeyBag = pkcs8ShroudedKeyBags.find((bag) => {
    const name = bag?.attributes?.friendlyName?.[0];
    return /signing|private|key/i.test(name) || !name;
  });

  if (!privateKeyBag) {
    throw new UnsuportedPkcs12Error("No private key bag found in BCE .p12");
  }

  const privateKey = privateKeyBag.key as forge.pki.rsa.PrivateKey;

  if (!privateKey) {
    throw new UnsuportedPkcs12Error("No valid key found in BCE .p12");
  }

  return privateKey;
}

const extractPrivateKeyAndCertificateFromPkcs12 = (
  pkcs12RawData: string | Buffer,
  password: string = ''
) => {
  const pkcs12InBase64 = typeof pkcs12RawData === 'string'
    ? pkcs12RawData
    : pkcs12RawData.toString('base64');

  const pkcs12InDer = forge.util.decode64(pkcs12InBase64);
  const p12Asn1 = forge.asn1.fromDer(pkcs12InDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  const pkcs8ShroudedKeyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

  if (!certBag) {
    throw new UnsuportedPkcs12Error("No certificate found in PKCS#12");
  }

  if (!pkcs8ShroudedKeyBags || Object.keys(pkcs8ShroudedKeyBags).length === 0) {
    throw new UnsuportedPkcs12Error("No private key found in PKCS#12");
  }

  const friendlyName = certBag?.attributes?.friendlyName?.[0];
  const certificate = certBag.cert;

  if (!certificate) {
    throw new UnsuportedPkcs12Error("Couldn't find certificate");
  }

  let privateKey: forge.pki.rsa.PrivateKey | null = null;

  const allKeyBags = [
    ...(pkcs8ShroudedKeyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(pkcs8ShroudedKeyBags[forge.pki.oids.keyBag] || []),
  ];

  if (/banco central/i.test(friendlyName) || /eci|bce/i.test(friendlyName)) {
    privateKey = getBancoCentralPkcs12PrivateKey(allKeyBags);
  } else {
    const firstKeyBag = allKeyBags[0];
    privateKey = firstKeyBag?.key ? firstKeyBag.key as forge.pki.rsa.PrivateKey : null;
  }

  if (!privateKey) {
    throw new UnsuportedPkcs12Error("Couldn't find private key");
  }

  return { privateKey, certificate };
}

const normalizeIssuerAttributeShortName = (shortName: string) => {
  switch (shortName) {
    case 'E':
      return 'EMAILADDRESS';
    default:
      return shortName;
  }
};

const extractIssuerData = (certificate: forge.pki.Certificate) => {
  const attributes = certificate.issuer.attributes
    .filter((attr) => attr.shortName || attr.type)
    .reverse();

  return attributes.map((attr) => {
    const name = attr.shortName ? normalizeIssuerAttributeShortName(attr.shortName) : attr.type;
    const value = attr.value || '';
    return `${name}=${value}`;
  }).join(',');
}

const forgeRsaPrivateKeyToKeyObject = (forgePrivateKey: forge.pki.rsa.PrivateKey): KeyObject => {
  const pem = forge.pki.privateKeyToPem(forgePrivateKey);
  return createPrivateKey({ key: pem, format: 'pem' });
};

export const createPreparedSigner = (
  pkcs12Data: string | Buffer,
  password: string = ''
): PreparedSigner => {
  const { privateKey: forgePrivateKey, certificate } = extractPrivateKeyAndCertificateFromPkcs12(pkcs12Data, password);

  const nativePrivateKey = forgeRsaPrivateKeyToKeyObject(forgePrivateKey);

  const serialNumber = new forge.jsbn.BigInteger(
    Array.from(Buffer.from(certificate.serialNumber, 'hex'))
  ).toString();

  const issuerName = extractIssuerData(certificate);

  const certAsn1 = forge.pki.certificateToAsn1(certificate);
  const certDer = forge.asn1.toDer(certAsn1);
  const certContent = forge.util.encode64(certDer.bytes());
  const certContentHash = sha1Base64Binary(certDer.bytes());

  const modulus = forge.util.encode64(
    forge.util.hexToBytes(forgePrivateKey.n.toString(16))
  );
  const exponent = forge.util.encode64(
    forge.util.hexToBytes(forgePrivateKey.e.toString(16))
  );

  return {
    sign: (data: string) => signRsaSha1(data, nativePrivateKey),
    getHash: (data: string) => sha1Base64(data),
    extractX509Data: () => ({
      content: certContent,
      contentHash: certContentHash,
      issuerName,
      serialNumber,
    }),
    extractPrivateKeyData: () => ({ modulus, exponent }),
  };
};
