import { describe, expect, it } from "vitest";

import { searchSupportContent, supportArticles, supportFaqs, supportTicketCreateSchema } from "@/lib/support/support";

describe("Help & Support domain", () => {
  it("searches guide titles, summaries, steps, and FAQ answers", () => {
    const result = searchSupportContent("confidence range");
    expect(result.articles.map((article) => article.id)).toContain("forecast-confidence");
    expect(result.faqs.some((faq) => faq.question.includes("forecast"))).toBe(true);
  });

  it("returns all curated content for an empty query", () => {
    expect(searchSupportContent("  ")).toEqual({ articles: supportArticles, faqs: supportFaqs });
  });

  it("validates and normalizes a local support ticket", () => {
    expect(supportTicketCreateSchema.parse({
      category: "TECHNICAL",
      priority: "NORMAL",
      subject: "  Gateway stopped publishing  ",
      message: "  My virtual gateway has not published data for the last ten minutes.  ",
      siteId: "site-1",
    })).toEqual({
      category: "TECHNICAL",
      priority: "NORMAL",
      subject: "Gateway stopped publishing",
      message: "My virtual gateway has not published data for the last ten minutes.",
      siteId: "site-1",
    });
  });

  it("rejects short, oversized, or malformed ticket fields", () => {
    expect(supportTicketCreateSchema.safeParse({ category: "TECHNICAL", priority: "NORMAL", subject: "Help", message: "Too short", siteId: null }).success).toBe(false);
    expect(supportTicketCreateSchema.safeParse({ category: "UNKNOWN", priority: "NORMAL", subject: "A valid subject", message: "This message contains enough useful detail for support.", siteId: null }).success).toBe(false);
  });
});
