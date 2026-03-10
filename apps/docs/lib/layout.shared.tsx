import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/clawpay-logo.png" alt="ClawPay" width={24} height={24} style={{ borderRadius: '4px' }} />
          ClawPay Docs
        </span>
      ),
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [
      {
      type: "icon",
      icon: "github",
      text: "GitHub",
      url: "https://github.com/EmadQureshiKhi/ClawPay",
    },
  ],
  };
}
