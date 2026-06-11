import { getCountryDisplayName, resolveCountry } from "@/lib/countries";

type CountryDisplayProps = {
  team: string;
  className?: string;
  flagClassName?: string;
};

export function CountryDisplay({
  team,
  className = "",
  flagClassName = "",
}: CountryDisplayProps) {
  const country = resolveCountry(team);

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {country ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={country.flag}
          alt={`${country.nameZh} flag`}
          className={`wc-flag ${flagClassName}`}
        />
      ) : null}
      <span className="min-w-0 truncate">{getCountryDisplayName(team)}</span>
    </span>
  );
}
