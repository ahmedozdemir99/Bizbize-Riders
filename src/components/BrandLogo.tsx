interface BrandLogoProps { className?: string; }

export function BrandLogo({ className = 'w-12 h-12' }: BrandLogoProps) {
  return <img src={`${import.meta.env.BASE_URL}logo.png`} alt="BizBize Riders logo" className={className} />;
}
