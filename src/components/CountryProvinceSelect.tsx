import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EU_COUNTRIES, getProvincesFor, DEFAULT_COUNTRY } from '@/lib/euLocations';
import { cn } from '@/lib/utils';

interface Props {
  country: string;
  province: string;
  onCountryChange: (code: string) => void;
  onProvinceChange: (province: string) => void;
  countryLabel?: string;
  provinceLabel?: string;
  required?: boolean;
  className?: string;
  /** When true the labels are not rendered (caller handles them, e.g. inside RHF FormItem). */
  hideLabels?: boolean;
}

const CountryProvinceSelect: React.FC<Props> = ({
  country, province, onCountryChange, onProvinceChange,
  countryLabel = 'País', provinceLabel = 'Província',
  required, className, hideLabels,
}) => {
  const effectiveCountry = country || DEFAULT_COUNTRY;
  const provinces = useMemo(() => getProvincesFor(effectiveCountry), [effectiveCountry]);

  return (
    <div className={cn('grid sm:grid-cols-2 gap-4', className)}>
      <div>
        {!hideLabels && <Label>{countryLabel}{required && ' *'}</Label>}
        <Select
          value={effectiveCountry}
          onValueChange={(v) => {
            onCountryChange(v);
            // Reset province when country changes (unless it still exists in new list)
            const stillValid = getProvincesFor(v).includes(province);
            if (!stillValid) onProvinceChange('');
          }}
        >
          <SelectTrigger><SelectValue placeholder={countryLabel} /></SelectTrigger>
          <SelectContent className="max-h-72">
            {EU_COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        {!hideLabels && <Label>{provinceLabel}{required && ' *'}</Label>}
        <Select
          value={province || ''}
          onValueChange={onProvinceChange}
          disabled={provinces.length === 0}
        >
          <SelectTrigger><SelectValue placeholder={provinceLabel} /></SelectTrigger>
          <SelectContent className="max-h-72">
            {provinces.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default CountryProvinceSelect;
