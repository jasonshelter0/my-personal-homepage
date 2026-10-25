import { useId, useState } from 'react';
import { filterSocialIcons, socialIcon } from '../../../shared/social-icons';
import './social-icon-picker.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  searchLabel: string;
  noResultsLabel?: string;
}

/** Native selection keeps keyboard and phone accessibility without a custom menu. */
export function SocialIconPicker({
  value,
  onChange,
  label,
  searchLabel,
  noResultsLabel = 'No matching icons. Your current selection is kept.',
}: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const selected = socialIcon(value);
  const matches = filterSocialIcons(query);
  // Filtering never changes a saved choice. Unknown legacy values are also kept.
  const needsSelectedOption = !matches.some((icon) => icon.id === value);
  const preview = selected ?? socialIcon('link')!;

  return (
    <div className="field social-icon-picker">
      <label htmlFor={`${id}-choice`}>{label}</label>
      <div className="social-icon-picker__choice">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          focusable="false"
          fill={preview.stroke ? 'none' : 'currentColor'}
          stroke={preview.stroke ? 'currentColor' : 'none'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          data-social-icon={selected?.id ?? 'link'}
        >
          <path d={preview.path} />
        </svg>
        <select
          id={`${id}-choice`}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery('');
          }}
        >
          {needsSelectedOption && <option value={value}>{selected?.label ?? value}</option>}
          {matches.map((icon) => (
            <option key={icon.id} value={icon.id}>
              {icon.label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="search"
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.length === 0 && (
        <span className="social-icon-picker__empty" role="status">
          {noResultsLabel}
        </span>
      )}
    </div>
  );
}
