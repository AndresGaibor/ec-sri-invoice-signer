# 📚 Documentación Completa - ec-sri-invoice-signer

> **Firmador de documentos electrónicos para el SRI (Servicio de Rentas Internas) de Ecuador**

## 📋 Tabla de Contenidos

1. [Resumen General](#resumen-general)
2. [Arquitectura del Proyecto](#arquitectura-del-proyecto)
3. [Dependencias](#dependencias)
4. [Módulos Principales](#módulos-principales)
   - [Módulo de Firma (Signature)](#módulo-de-firma-signature)
   - [Módulo de Canonicalización (C14N)](#módulo-de-canonicalización-c14n)
   - [Módulo de Utilidades](#módulo-de-utilidades)
5. [Templates de Firma XML](#templates-de-firma-xml)
6. [Sistema de Validación](#sistema-de-validación)
7. [Utilidades de Clave de Acceso](#utilidades-de-clave-de-acceso)
8. [Tests](#tests)
9. [Ejemplos de Uso](#ejemplos-de-uso)

---

## Resumen General

**ec-sri-invoice-signer** es una librería TypeScript/JavaScript diseñada para firmar digitalmente documentos electrónicos según las especificaciones del Servicio de Rentas Internas (SRI) de Ecuador.

### Características Principales

- ✅ **Sin dependencias binarias**: No requiere OpenSSL, DLLs ni binarios externos
- ✅ **Multiplataforma**: Funciona en Windows, Linux, macOS y cualquier plataforma que soporte Node.js
- ✅ **Soporte completo de documentos**: Facturas, notas de débito, notas de crédito, comprobantes de retención, guías de remisión y liquidaciones de compra
- ✅ **Generación de claves de acceso**: Utilidades para generar y validar claves de acceso del SRI
- ✅ **Firma XAdES-BES**: Implementación de firma digital según estándar XAdES

### Versión Actual
```
v1.4.0
```

---

## Arquitectura del Proyecto

```
src/
├── index.ts                    # Punto de entrada principal
├── index.d.ts                  # Definiciones de tipos TypeScript
├── canonicalization/           # Módulo de canonicalización XML
│   ├── c14n.ts                 # Algoritmo C14N principal
│   └── utils.ts                # Utilidades de procesamiento
├── signature/                  # Módulo de firma digital
│   ├── signature.ts            # Funciones de firma
│   └── templates/              # Templates XML para firma
│       ├── keyInfo.ts          # Template KeyInfo
│       ├── signature.ts        # Template Signature
│       ├── signedInfo.ts       # Template SignedInfo
│       └── signedProperties.ts # Template SignedProperties
└── utils/                      # Utilidades generales
    ├── access-key.ts           # Generación de claves de acceso
    ├── constants.ts            # Constantes (namespaces, algoritmos)
    ├── cryptography.ts         # Funciones criptográficas
    ├── errors.ts               # Clases de error personalizadas
    ├── utils.ts                # Utilidades generales
    ├── xml-validator.ts        # Validador de XML
    └── xml.ts                  # Parser y builder de XML
```

---

## Dependencias

### Producción
| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `fast-xml-parser` | ^4.2.5 | Parser y builder de XML de alto rendimiento |
| `node-forge` | ^1.3.1 | Librería criptográfica para manejo de certificados y firmas |

### Desarrollo
| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `jest` | ^30.1.3 | Framework de testing |
| `ts-jest` | ^29.4.1 | Preset de Jest para TypeScript |
| `typescript` | ^5.9.2 | Compilador TypeScript |
| `soap` | ^1.0.0 | Cliente SOAP para tests en vivo |

---

## Módulos Principales

### Módulo de Firma (Signature)

📁 **Ubicación**: `src/signature/signature.ts`

Este es el módulo central que maneja la firma digital de documentos XML.

#### Funciones Exportadas

##### `signInvoiceXml(xml, pkcs12Data, options?)`
Firma una factura electrónica.

```typescript
/**
 * @param xml - El XML de la factura a firmar
 * @param pkcs12Data - Datos del archivo .p12/.pfx (Buffer o string base64)
 * @param options - Opciones opcionales
 *   - pkcs12Password: Contraseña del archivo .p12 (default: '')
 * @returns XML firmado
 */
signInvoiceXml(xml: string, pkcs12Data: string | Buffer, options?: signXmlOptions): string
```

##### `signDebitNoteXml(xml, pkcs12Data, options?)`
Firma una nota de débito electrónica.
- **Tag raíz esperado**: `<notaDebito>`

##### `signCreditNoteXml(xml, pkcs12Data, options?)`
Firma una nota de crédito electrónica.
- **Tag raíz esperado**: `<notaCredito>`

##### `signRetentionVoucherXml(xml, pkcs12Data, options?)`
Firma un comprobante de retención electrónico.
- **Tag raíz esperado**: `<comprobanteRetencion>`

##### `signShippingGuideXml(xml, pkcs12Data, options?)`
Firma una guía de remisión electrónica.
- **Tag raíz esperado**: `<guiaRemision>`

##### `signPurchaseLiquidationXml(xml, pkcs12Data, options?)`
Firma una liquidación de compra electrónica.
- **Tag raíz esperado**: `<liquidacionCompra>`

#### Proceso de Firma

El proceso interno de firma (`signDocumentXml`) realiza los siguientes pasos:

1. **Extracción de datos del certificado PKCS12**:
   - Llave privada RSA
   - Certificado X.509
   - Módulo y exponente del certificado
   - Datos del emisor (issuer)

2. **Generación de IDs únicos** para cada componente de la firma:
   - `DocumentRef-{UUID}`
   - `Certificate-{UUID}`
   - `SignedInfo-{UUID}`
   - `SignedProperties-{UUID}`
   - `Signature-{UUID}`

3. **Construcción de componentes de firma**:
   - `KeyInfo`: Información del certificado
   - `SignedProperties`: Propiedades firmadas (tiempo, certificado)
   - `SignedInfo`: Referencias y algoritmos

4. **Cálculo de hashes SHA1**:
   - Hash del documento canonicalizado
   - Hash de `SignedProperties` canonicalizado
   - Hash de `KeyInfo` canonicalizado

5. **Firma digital**:
   - Firma RSA-SHA1 del `SignedInfo` canonicalizado

6. **Inserción de firma**:
   - La firma se inserta justo antes del tag de cierre del documento raíz

---

### Módulo de Canonicalización (C14N)

📁 **Ubicación**: `src/canonicalization/c14n.ts`

Implementa el algoritmo de canonicalización XML C14N según la especificación W3C (parcialmente).

#### Función Principal

```typescript
c14nCanonicalize(xml: string, options?: { inheritedNamespaces: Namespace[] }): string
```

#### Qué hace la canonicalización:

1. **Elimina la declaración XML** (`<?xml version="1.0"?>`)
2. **Elimina comentarios** (`<!-- ... -->`)
3. **Ordena atributos alfabéticamente**
4. **Ordena namespaces**: Namespace por defecto primero, luego por prefijo
5. **Normaliza whitespace** en valores de atributos
6. **Convierte comillas simples a dobles** en atributos
7. **Convierte tags vacíos** de `<tag/>` a `<tag></tag>`
8. **Procesa entidades** correctamente

#### Limitaciones

El módulo **NO** implementa la especificación C14N completa. Características **NO soportadas**:
- Múltiples namespaces
- Etiquetas DOCTYPE
- Atributos con prefijo `xml:`
- Processing instructions (excepto declaración XML)

#### Utilidades de Canonicalización

📁 **Ubicación**: `src/canonicalization/utils.ts`

##### `processAttributeValue(value: string): string`
Procesa valores de atributos:
- Capitaliza caracteres en entidades hexadecimales
- Convierte entidades decimales a hexadecimales
- Codifica caracteres especiales (`&`, `<`, `"`, `\r`, `\n`, `\t`)
- Decodifica entidades UTF-8 hexadecimales (excepto `&#xD;`, `&#xA;`, `&#x9;`)
- Normaliza whitespace

##### `processTagValue(value: string): string`
Procesa valores de etiquetas:
- Capitaliza caracteres en entidades hexadecimales
- Convierte entidades decimales a hexadecimales
- Codifica caracteres especiales (`&`, `<`, `>`, `\r`)
- Decodifica entidades UTF-8 (excepto `&amp;`, `&lt;`, `&gt;`, `&#xD;`)

---

### Módulo de Utilidades

#### Constantes (`src/utils/constants.ts`)

```typescript
const XmlProperties = {
  namespaces: {
    ds: 'http://www.w3.org/2000/09/xmldsig#',
    xades: 'http://uri.etsi.org/01903/v1.3.2#'
  },
  algorithms: {
    canonicalization: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    digest: 'http://www.w3.org/2000/09/xmldsig#sha1',
    signature: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    transform: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  },
  types: {
    signedProperties: 'http://uri.etsi.org/01903#SignedProperties'
  }
};
```

#### Criptografía (`src/utils/cryptography.ts`)

##### `sign(data: string, privateKey: forge.pki.rsa.PrivateKey): string`
Firma datos con SHA1 + RSA y retorna la firma en base64.

##### `getHash(data: string): string`
Calcula el hash SHA1 de una cadena y lo retorna en base64.

##### `extractPrivateKeyAndCertificateFromPkcs12(pkcs12RawData, password?)`
Extrae la llave privada y certificado de un archivo PKCS12.

**Soporte especial para certificados del Banco Central del Ecuador**:
- Busca el bag con `friendlyName: 'Signing Key'`

##### `extractX509Data(certificate)`
Extrae datos X.509 del certificado:
- `content`: Certificado en base64
- `contentHash`: Hash SHA1 del certificado
- `issuerName`: Nombre del emisor (formato DN)
- `serialNumber`: Número de serie

##### `extractPrivateKeyData(privateKey)`
Extrae módulo y exponente de la llave privada RSA.

#### Utilidades Generales (`src/utils/utils.ts`)

##### `getRandomUuid(): string`
Genera un UUID v4 aleatorio.

##### `getDate(): string`
Retorna la fecha actual en formato ISO 8601 con timezone local.
```
Formato: YYYY-MM-DDTHH:mm:ss.sss[-+]HH:mm
Ejemplo: 2024-04-18T14:34:32.878-05:00
```

##### `pipe<T>(functions: Function[])`
Compone funciones de forma funcional (pipeline).

#### XML Parser/Builder (`src/utils/xml.ts`)

##### `parseXml(xml: string): XmlObj`
Parsea XML a un objeto JavaScript preservando:
- Orden de elementos
- Comentarios (para procesamiento posterior)
- Atributos
- Whitespace en valores

##### `buildXml(data: Record<any, any>): string`
Construye XML desde un objeto JavaScript.

#### Errores Personalizados (`src/utils/errors.ts`)

| Error | Descripción |
|-------|-------------|
| `XmlFormatError` | Error de formato en el XML |
| `UnsuportedPkcs12Error` | Archivo .p12 no soportado o corrupto |
| `UnsupportedXmlFeatureError` | Característica XML no soportada |
| `UnsupportedDocumentTypeError` | Tipo de documento no soportado |

---

## Templates de Firma XML

Los templates generan las secciones XML requeridas para la firma digital XAdES.

### KeyInfo (`src/signature/templates/keyInfo.ts`)

Genera el tag `<ds:KeyInfo>` que contiene:
- Certificado X.509
- Valor de la clave RSA (módulo y exponente)

```xml
<ds:KeyInfo Id="Certificate-{UUID}">
  <ds:X509Data>
    <ds:X509Certificate>{CERTIFICATE_BASE64}</ds:X509Certificate>
  </ds:X509Data>
  <ds:KeyValue>
    <ds:RSAKeyValue>
      <ds:Modulus>{MODULUS}</ds:Modulus>
      <ds:Exponent>{EXPONENT}</ds:Exponent>
    </ds:RSAKeyValue>
  </ds:KeyValue>
</ds:KeyInfo>
```

### SignedInfo (`src/signature/templates/signedInfo.ts`)

Genera el tag `<ds:SignedInfo>` con referencias a:
- Documento original (factura/nota)
- SignedProperties
- KeyInfo

```xml
<ds:SignedInfo Id="SignedInfo-{UUID}">
  <ds:CanonicalizationMethod Algorithm="..."/>
  <ds:SignatureMethod Algorithm="..."/>
  <ds:Reference Id="..." URI="#comprobante">
    <ds:Transforms>
      <ds:Transform Algorithm="...enveloped-signature"/>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="...sha1"/>
    <ds:DigestValue>{DOCUMENT_HASH}</ds:DigestValue>
  </ds:Reference>
  <ds:Reference Id="..." Type="...#SignedProperties" URI="#...">
    <ds:DigestMethod Algorithm="...sha1"/>
    <ds:DigestValue>{SIGNED_PROPERTIES_HASH}</ds:DigestValue>
  </ds:Reference>
  <ds:Reference Id="..." URI="#...">
    <ds:DigestMethod Algorithm="...sha1"/>
    <ds:DigestValue>{KEY_INFO_HASH}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>
```

### SignedProperties (`src/signature/templates/signedProperties.ts`)

Genera el tag `<xades:SignedProperties>` con:
- Tiempo de firma
- Información del certificado firmante
- Descripción del objeto de datos

```xml
<xades:SignedProperties Id="SignedProperties-{UUID}">
  <xades:SignedSignatureProperties>
    <xades:SigningTime>{ISO_DATETIME}</xades:SigningTime>
    <xades:SigningCertificate>
      <xades:Cert>
        <xades:CertDigest>
          <ds:DigestMethod Algorithm="...sha1"/>
          <ds:DigestValue>{CERT_HASH}</ds:DigestValue>
        </xades:CertDigest>
        <xades:IssuerSerial>
          <ds:X509IssuerName>{ISSUER_DN}</ds:X509IssuerName>
          <ds:X509SerialNumber>{SERIAL_NUMBER}</ds:X509SerialNumber>
        </xades:IssuerSerial>
      </xades:Cert>
    </xades:SigningCertificate>
  </xades:SignedSignatureProperties>
  <xades:SignedDataObjectProperties>
    <xades:DataObjectFormat ObjectReference="#...">
      <xades:Description>Firma digital</xades:Description>
      <xades:MimeType>text/xml</xades:MimeType>
      <xades:Encoding>UTF-8</xades:Encoding>
    </xades:DataObjectFormat>
  </xades:SignedDataObjectProperties>
</xades:SignedProperties>
```

### Signature Principal (`src/signature/templates/signature.ts`)

Ensambla todos los componentes en la estructura final:

```xml
<ds:Signature xmlns:ds="..." Id="Signature-{UUID}">
  {SIGNED_INFO}
  <ds:SignatureValue Id="SignatureValue-{UUID}">
    {RSA_SIGNATURE_BASE64}
  </ds:SignatureValue>
  {KEY_INFO}
  <ds:Object Id="SignatureObject-{UUID}">
    <xades:QualifyingProperties xmlns:xades="..." Target="#Signature-{UUID}">
      {SIGNED_PROPERTIES}
    </xades:QualifyingProperties>
  </ds:Object>
</ds:Signature>
```

---

## Sistema de Validación

📁 **Ubicación**: `src/utils/xml-validator.ts`

### Tipos de Documentos Soportados

| Tipo | Tag Raíz | Código SRI |
|------|----------|------------|
| Factura | `factura` | 01 |
| Liquidación de Compra | `liquidacionCompra` | 03 |
| Nota de Crédito | `notaCredito` | 04 |
| Nota de Débito | `notaDebito` | 05 |
| Guía de Remisión | `guiaRemision` | 06 |
| Comprobante de Retención | `comprobanteRetencion` | 07 |

### Validaciones Realizadas

1. **Tipo de documento válido**: El tag raíz debe ser uno de los soportados
2. **Sin DOCTYPE**: No se permiten declaraciones DOCTYPE
3. **Sin atributos xml:**: No se permiten atributos con prefijo `xml:`
4. **Sin namespaces**: No se permiten declaraciones `xmlns:` en el documento
5. **Atributo Id requerido**: El elemento raíz debe tener `Id="comprobante"`

---

## Utilidades de Clave de Acceso

📁 **Ubicación**: `src/utils/access-key.ts`

La clave de acceso es un código numérico de 49 dígitos requerido por el SRI para identificar documentos electrónicos.

### Estructura de la Clave de Acceso

| Posición | Longitud | Campo | Descripción |
|----------|----------|-------|-------------|
| 1-8 | 8 | Fecha | Formato ddmmaaaa |
| 9-10 | 2 | Tipo documento | 01-07 |
| 11-23 | 13 | RUC | Número de RUC |
| 24-25 | 2 | Ambiente | 01=pruebas, 02=producción |
| 26-28 | 3 | Establecimiento | Serie (establecimiento) |
| 29-31 | 3 | Punto emisión | Serie (punto de emisión) |
| 32-40 | 9 | Secuencial | Número secuencial |
| 41-48 | 8 | Código numérico | Código aleatorio |
| 49 | 1 | Dígito verificador | Módulo 11 |

### Funciones Disponibles

#### `generateAccessKey(components: AccessKeyComponents): string`
Genera una clave de acceso completa de 49 dígitos.

```typescript
interface AccessKeyComponents {
  date: string;           // "ddmmaaaa" (8 dígitos)
  documentType: string;   // "01"-"07" (2 dígitos)
  ruc: string;            // RUC (13 dígitos)
  environment: "01" | "02"; // Ambiente
  establishment: string;  // Establecimiento (3 dígitos)
  emissionPoint: string;  // Punto emisión (3 dígitos)
  sequential: string;     // Secuencial (9 dígitos)
  numericCode?: string;   // Código aleatorio (8 dígitos, opcional)
}
```

**Ejemplo:**
```typescript
const accessKey = generateAccessKey({
  date: "18042024",
  documentType: "01",
  ruc: "1234567890001",
  environment: "01",
  establishment: "001",
  emissionPoint: "001",
  sequential: "000000005"
});
// Retorna: "1804202401123456789000110010010000000051234567816"
```

#### `validateAccessKey(accessKey: string): boolean`
Valida si una clave de acceso es válida (verifica el dígito verificador).

#### `calculateCheckDigit(accessKeyWithoutCheckDigit: string): number`
Calcula el dígito verificador usando el algoritmo módulo 11 del SRI.

#### `parseAccessKey(accessKey: string): AccessKeyComponents & { checkDigit: string }`
Descompone una clave de acceso en sus componentes individuales.

---

## Tests

El proyecto cuenta con una suite completa de tests usando Jest.

### Comandos de Test

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con cobertura
npm run test:coverage

# Test en vivo con el SRI (factura)
npm run test:sri:invoice

# Test en vivo con el SRI (nota de débito)
npm run test:sri:debit-note
```

### Estructura de Tests

```
test/
├── index.test.ts                    # Tests de exportaciones
├── canonicalization/
│   ├── c14n.test.ts                 # Tests de canonicalización
│   └── utils.test.ts                # Tests de utilidades C14N
├── signature/
│   └── signature.test.ts            # Tests de firma digital
├── utils/
│   ├── access-key.test.ts           # Tests de clave de acceso
│   ├── cryptography.test.ts         # Tests de criptografía
│   ├── errors.test.ts               # Tests de errores
│   ├── utils.test.ts                # Tests de utilidades
│   ├── xml.test.ts                  # Tests de XML parser
│   └── xml-validator.test.ts        # Tests de validación XML
├── test-utils/
│   └── cryptography.ts              # Utilidades de test (verificación de firma)
├── test-data/                       # Datos de prueba
│   ├── invoice/
│   │   ├── original.xml             # Factura sin firmar
│   │   └── signed.xml               # Factura firmada (esperada)
│   ├── debit-note/
│   │   ├── original.xml             # Nota de débito sin firmar
│   │   └── signed.xml               # Nota de débito firmada
│   └── pkcs12/
│       └── signature.p12            # Certificado de prueba
└── sri-live-test/                   # Tests en vivo con SRI
    ├── utils.ts                     # Utilidades para tests en vivo
    ├── invoice/
    │   └── invoice.ts               # Test en vivo de factura
    └── debit-note/
        └── debit-note.ts            # Test en vivo de nota de débito
```

### Resumen de Tests por Módulo

#### Tests de Exportación (`test/index.test.ts`)
| Test | Descripción |
|------|-------------|
| `signInvoiceXml function should be exported` | Verifica exportación de función de firma de facturas |
| `signDebitNoteXml function should be exported` | Verifica exportación de función de firma de notas de débito |
| `signCreditNoteXml function should be exported` | Verifica exportación de función de firma de notas de crédito |
| `signRetentionVoucherXml function should be exported` | Verifica exportación de función de firma de retenciones |
| `signShippingGuideXml function should be exported` | Verifica exportación de función de firma de guías de remisión |
| `signPurchaseLiquidationXml function should be exported` | Verifica exportación de función de firma de liquidaciones |

#### Tests de Firma (`test/signature/signature.test.ts`)
| Test | Descripción |
|------|-------------|
| `should generate the signature for the invoice` | Firma una factura y compara con resultado esperado |
| `should handle certificate with email address in issuer` | Maneja certificados con campo E (email) en emisor |
| `should generate the signature for debit note` | Firma una nota de débito correctamente |

#### Tests de Canonicalización (`test/canonicalization/c14n.test.ts`)
| Test | Descripción |
|------|-------------|
| `Removes doc declaration, comments, sorts attributes...` | Test completo de canonicalización |
| `should replace whitespace between attributes` | Normaliza espacios entre atributos |
| `should remove whitespace from closing tags` | Limpia whitespace de tags de cierre |
| `should set inherited namespaces` | Maneja namespaces heredados |
| `should override parent namespace with child` | Prioridad de namespaces locales |
| `should process entities in elements and attributes` | Procesa entidades XML correctamente |

#### Tests de Utilidades C14N (`test/canonicalization/utils.test.ts`)
| Test | Descripción |
|------|-------------|
| `Capitalizes lowercase chars in hex entities` | `&#xd;` → `&#xD;` |
| `Converts decimal entities to hex` | `&#013;` → `&#xD;` |
| `encodes special characters` | Codifica `<`, `>`, `&`, `"`, etc. |
| `does not decode certain entities` | Preserva `&amp;`, `&lt;`, `&gt;` |

#### Tests de Criptografía (`test/utils/cryptography.test.ts`)
| Test | Descripción |
|------|-------------|
| `sign should return valid signature` | Verifica que la firma es válida |
| `getHash should return SHA1 in base64` | Verifica cálculo de hash |
| `extractPrivateKeyAndCertificateFromPkcs12` | Extrae correctamente datos del .p12 |
| `extractIssuerData should return inverted issuer` | Formato correcto de issuer DN |
| `should convert 'E' to 'EMAILADDRESS'` | Normalización para SRI |

#### Tests de Clave de Acceso (`test/utils/access-key.test.ts`)
| Test | Descripción |
|------|-------------|
| `should calculate correct check digit` | Cálculo de dígito verificador |
| `should return 0 when modulo result is 11` | Caso especial módulo 11 |
| `should return 1 when modulo result is 10` | Caso especial módulo 10 |
| `should generate valid 49-digit access key` | Generación completa |
| `should generate random numeric code if not provided` | Código aleatorio |
| `should accept all valid document types` | Tipos 01-07 |
| `should validate a correct access key` | Validación correcta |
| `should reject incorrect check digit` | Rechazo de dígito inválido |
| `should correctly parse a valid access key` | Parsing de componentes |

#### Tests de Validación XML (`test/utils/xml-validator.test.ts`)
| Test | Descripción |
|------|-------------|
| `should validate a proper invoice XML` | Valida factura correcta |
| `should validate a proper debit note XML` | Valida nota de débito correcta |
| `should validate a proper credit note XML` | Valida nota de crédito correcta |
| `should validate a proper retention voucher XML` | Valida retención correcta |
| `should throw for unsupported document type` | Error en tipo no soportado |
| `should throw for XML with namespaces` | Error en namespace |
| `should throw for missing Id attribute` | Error sin atributo Id |

---

## Ejemplos de Uso

### Firma Básica de Factura

```typescript
import fs from 'fs';
import { signInvoiceXml } from 'ec-sri-invoice-signer';

// Leer XML de factura
const invoiceXml = fs.readFileSync('factura.xml', 'utf-8');

// Leer certificado PKCS12
const p12Data = fs.readFileSync('certificado.p12');

// Firmar la factura
const signedInvoice = signInvoiceXml(invoiceXml, p12Data, {
  pkcs12Password: 'miContraseña'
});

// Guardar factura firmada
fs.writeFileSync('factura-firmada.xml', signedInvoice);
```

### Generar Clave de Acceso

```typescript
import { utils } from 'ec-sri-invoice-signer';

const accessKey = utils.generateAccessKey({
  date: "25122024",           // 25 de diciembre de 2024
  documentType: "01",         // Factura
  ruc: "1792123456001",       // RUC de la empresa
  environment: "02",          // Producción
  establishment: "001",       // Establecimiento 001
  emissionPoint: "001",       // Punto de emisión 001
  sequential: "000000001"     // Secuencial 1
});

console.log('Clave de acceso:', accessKey);

// Validar clave de acceso
const isValid = utils.validateAccessKey(accessKey);
console.log('Es válida:', isValid);

// Parsear clave de acceso
const components = utils.parseAccessKey(accessKey);
console.log('Componentes:', components);
```

### Firma con Certificado en Base64

```typescript
import { signCreditNoteXml } from 'ec-sri-invoice-signer';

// Certificado en base64 (por ejemplo, desde una base de datos)
const p12Base64 = 'MIIKQQIBAzCCCf...';

const signedCreditNote = signCreditNoteXml(
  creditNoteXml,
  p12Base64,  // Acepta string base64 directamente
  { pkcs12Password: 'password' }
);
```

---

## Notas de Compatibilidad

### Requisitos del XML de Entrada

1. **Encoding UTF-8**: El documento debe estar codificado en UTF-8
2. **Atributo Id requerido**: El elemento raíz debe tener `Id="comprobante"`
3. **Sin namespaces**: No incluir declaraciones xmlns en el documento
4. **Sin DOCTYPE**: No incluir declaraciones DOCTYPE

### Ejemplo de XML Válido

```xml
<?xml version="1.0" encoding="UTF-8"?>
<factura Id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>1</ambiente>
    <tipoEmision>1</tipoEmision>
    <ruc>1234567890123</ruc>
    <!-- más campos... -->
  </infoTributaria>
  <infoFactura>
    <!-- campos de factura... -->
  </infoFactura>
  <detalles>
    <!-- detalles... -->
  </detalles>
</factura>
```

---

## Licencia

MIT License - Bryan Calisto

---

*Documentación generada automáticamente el 25 de diciembre de 2024*
