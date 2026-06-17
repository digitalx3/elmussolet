
ALTER TABLE public.cms_blocks ADD COLUMN IF NOT EXISTS custom_class text;

INSERT INTO public.site_settings (key, value)
VALUES ('appearance_config', '{"bodyFont":"Nunito","headingFont":"Sweet Pea","loadGoogleFonts":"Nunito:wght@300;400;500;600;700;800|Quicksand:wght@400;500;600;700","elements":{"h1":{"fontFamily":"","fontSize":"","fontWeight":"","color":"","letterSpacing":""},"h2":{"fontFamily":"","fontSize":"","fontWeight":"","color":"","letterSpacing":""},"h3":{"fontFamily":"","fontSize":"","fontWeight":"","color":"","letterSpacing":""},"h4":{"fontFamily":"","fontSize":"","fontWeight":"","color":"","letterSpacing":""},"p":{"fontFamily":"","fontSize":"","fontWeight":"","color":"","letterSpacing":""},"a":{"fontFamily":"","fontSize":"","fontWeight":"","color":"","letterSpacing":""}},"customCss":"","customJsHead":"","customJsFooter":""}')
ON CONFLICT (key) DO NOTHING;
