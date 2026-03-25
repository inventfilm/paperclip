import { describe, expect, it } from "vitest";
import { applyBillingModeOverride } from "@paperclipai/adapter-utils/server-utils";

describe("applyBillingModeOverride", () => {
  it("returns auto-detected value when billingMode is 'auto'", () => {
    expect(applyBillingModeOverride("api", "auto")).toBe("api");
    expect(applyBillingModeOverride("subscription", "auto")).toBe("subscription");
  });

  it("returns auto-detected value when billingMode is empty", () => {
    expect(applyBillingModeOverride("api", "")).toBe("api");
    expect(applyBillingModeOverride("subscription", "")).toBe("subscription");
  });

  it("overrides to subscription when billingMode is 'subscription'", () => {
    expect(applyBillingModeOverride("api", "subscription")).toBe("subscription");
    expect(applyBillingModeOverride("subscription", "subscription")).toBe("subscription");
  });

  it("overrides to api when billingMode is 'metered'", () => {
    expect(applyBillingModeOverride("subscription", "metered")).toBe("api");
    expect(applyBillingModeOverride("api", "metered")).toBe("api");
  });

  it("overrides to api when billingMode is 'api'", () => {
    expect(applyBillingModeOverride("subscription", "api")).toBe("api");
  });

  it("normalizes whitespace and casing", () => {
    expect(applyBillingModeOverride("api", " Subscription ")).toBe("subscription");
    expect(applyBillingModeOverride("subscription", " METERED ")).toBe("api");
    expect(applyBillingModeOverride("api", "  AUTO  ")).toBe("api");
  });

  it("falls through for unrecognized values", () => {
    expect(applyBillingModeOverride("api", "something_else")).toBe("api");
    expect(applyBillingModeOverride("subscription", "credits")).toBe("subscription");
  });
});
