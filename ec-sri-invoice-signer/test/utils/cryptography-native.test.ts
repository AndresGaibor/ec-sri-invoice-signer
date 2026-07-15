import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { getHash, sign, extractPrivateKeyAndCertificateFromPkcs12 } from '../../src/utils/cryptography';
import { createPreparedSigner } from '../../src/utils/cryptography-native';
import { signInvoiceXml } from '../../src/signature/signature';
import { verifySignature } from '../test-utils/cryptography';
import * as forge from 'node-forge';
import * as Utils from '../../src/utils/utils';
import fs from 'fs';
import path from 'path';

const signatureP12 = fs.readFileSync(path.resolve('test/test-data/pkcs12/signature.p12'));

describe('Given the native SHA-1 (getHash)', () => {
  it('should produce the same hash as node-forge', () => {
    const data = 'something';

    const forgeHash = getHash(data);

    const ps = createPreparedSigner(signatureP12);
    const nativeHash = ps.getHash(data);

    expect(nativeHash).toEqual(forgeHash);
  });

  it('should match the known SHA-1 hash for "something"', () => {
    const ps = createPreparedSigner(signatureP12);
    expect(ps.getHash('something')).toEqual('GvF+c3IdvgxAARuC7Uuxp9vjzik=');
  });
});

describe('Given the native RSA-SHA1 signing', () => {
  it('should produce a valid signature verifiable with the public key', () => {
    const data = 'something to sign';
    const ps = createPreparedSigner(signatureP12);
    const { certificate } = extractPrivateKeyAndCertificateFromPkcs12(signatureP12);

    const nativeSignature = ps.sign(data);
    const verified = verifySignature(data, certificate.publicKey as forge.pki.rsa.PublicKey, nativeSignature);

    expect(verified).toBe(true);
  });

  it('should produce the same signature as node-forge', () => {
    const data = 'something to sign';
    const { privateKey } = extractPrivateKeyAndCertificateFromPkcs12(signatureP12);
    const ps = createPreparedSigner(signatureP12);

    const forgeSignature = sign(data, privateKey);
    const nativeSignature = ps.sign(data);

    expect(nativeSignature).toEqual(forgeSignature);
  });
});

describe('Given the PreparedSigner extractX509Data', () => {
  it('should return the same data as the forge version', () => {
    const { certificate } = extractPrivateKeyAndCertificateFromPkcs12(signatureP12);
    const ps = createPreparedSigner(signatureP12);

    const forgeX509 = (() => {
      const serialNumber = new forge.jsbn.BigInteger(Array.from(Buffer.from(certificate.serialNumber, 'hex'))).toString();
      const certAsn1 = forge.pki.certificateToAsn1(certificate);
      const certDer = forge.asn1.toDer(certAsn1);
      return {
        serialNumber,
        content: forge.util.encode64(certDer.bytes()),
      };
    })();

    const nativeX509 = ps.extractX509Data();

    expect(nativeX509.serialNumber).toEqual(forgeX509.serialNumber);
    expect(nativeX509.content).toEqual(forgeX509.content);
    expect(nativeX509.issuerName).toBeTruthy();
  });
});

describe('Given the PreparedSigner extractPrivateKeyData', () => {
  it('should return the same modulus and exponent as the forge version', () => {
    const { privateKey } = extractPrivateKeyAndCertificateFromPkcs12(signatureP12);
    const ps = createPreparedSigner(signatureP12);

    const forgeModulus = forge.util.encode64(forge.util.hexToBytes(privateKey.n.toString(16)));
    const forgeExponent = forge.util.encode64(forge.util.hexToBytes(privateKey.e.toString(16)));

    const nativeData = ps.extractPrivateKeyData();

    expect(nativeData.modulus).toEqual(forgeModulus);
    expect(nativeData.exponent).toEqual(forgeExponent);
  });
});

describe('Given signInvoiceXml with PreparedSigner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should produce the exact same signed XML as the forge version', () => {
    const invoiceXml = fs.readFileSync(path.resolve('test/test-data/invoice/original.xml')).toString();
    const pkcs12Data = fs.readFileSync(path.resolve('test/test-data/pkcs12/signature.p12')).toString('base64');
    const signedInvoice = fs.readFileSync(path.resolve('test/test-data/invoice/signed.xml')).toString();

    jest.spyOn(Utils, 'getDate').mockReturnValue('2024-04-18T14:34:32.878-05:00');
    jest.spyOn(Utils, 'getRandomUuid').mockReturnValue('5bdfc32d-a37f-47c3-90fe-49f5a093b7bf');

    const ps = createPreparedSigner(signatureP12, '');
    const result = signInvoiceXml(invoiceXml, pkcs12Data, { pkcs12Password: '', preparedSigner: ps });

    expect(result).toEqual(signedInvoice);
  });
});
