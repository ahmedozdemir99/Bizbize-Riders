interface BrandLogoProps { className?: string; }

export function BrandLogo({ className = 'w-12 h-12' }: BrandLogoProps) {
  return <img src={`${import.meta.env.BASE_URL}logo.svg`} width={96} height={96} alt="BizBize Riders kask logosu" className={className} />;
}
