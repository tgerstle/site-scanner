import type { AuditContext, AuditPlugin } from "types";

export const CustomExtractorPlugin: AuditPlugin = {
  name: "custom-extractor",
  async run(ctx: AuditContext) {
    const description = await ctx.page
      .$eval('meta[name="description"]', (el) => el.getAttribute("content"))
      .catch(() => null);

    const language = await ctx.page
      .$eval("html", (el) => el.getAttribute("lang"))
      .catch(() => null);

    ctx.results.custom_data = {
      ...ctx.results.custom_data,
      metaDescription: description,
      language,
    };
  },
};
