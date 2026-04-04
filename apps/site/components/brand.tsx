import Image from 'next/image';
import Link from 'next/link';

type BrandProps = {
  href?: string;
  className?: string;
  variant?: 'header' | 'footer' | 'maintenance';
  priority?: boolean;
};

const variantSizes = {
  header: { width: 132, height: 63 },
  footer: { width: 136, height: 65 },
  maintenance: { width: 164, height: 78 },
} as const;

export function Brand({ href, className = '', variant = 'header', priority = false }: BrandProps) {
  const size = variantSizes[variant];
  const classes = ['brand', `brand--${variant}`, className].filter(Boolean).join(' ');

  const logo = (
    <Image
      src="/revio-logo-full.png"
      alt="Revio"
      width={size.width}
      height={size.height}
      priority={priority}
      className="brand-logo"
    />
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label="Revio Startseite">
        {logo}
      </Link>
    );
  }

  return (
    <div className={classes} aria-label="Revio">
      {logo}
    </div>
  );
}
