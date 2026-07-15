import { describe, test, expect } from "@jest/globals";
import {
  signCreditNoteXml,
  signRetentionVoucherXml,
  signShippingGuideXml,
  signPurchaseLiquidationXml,
  signDocumentXml,
  signInvoiceXml,
  signDebitNoteXml
} from "../../src/signature/signature";

describe("Function Export and Availability", () => {
  test("signInvoiceXml function should be exported", () => {
    expect(typeof signInvoiceXml).toBe("function");
  });

  test("signDebitNoteXml function should be exported", () => {
    expect(typeof signDebitNoteXml).toBe("function");
  });

  test("signCreditNoteXml function should be exported", () => {
    expect(typeof signCreditNoteXml).toBe("function");
  });

  test("signRetentionVoucherXml function should be exported", () => {
    expect(typeof signRetentionVoucherXml).toBe("function");
  });

  test("signShippingGuideXml function should be exported", () => {
    expect(typeof signShippingGuideXml).toBe("function");
  });

  test("signPurchaseLiquidationXml function should be exported", () => {
    expect(typeof signPurchaseLiquidationXml).toBe("function");
  });

  test("signDocumentXml function should be exported", () => {
    expect(typeof signDocumentXml).toBe("function");
  });
});