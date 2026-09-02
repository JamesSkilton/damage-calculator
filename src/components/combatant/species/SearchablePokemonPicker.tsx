import type { SpeciesOption } from './speciesOptions';
import { filterSpeciesOptions } from './speciesOptions';
import SearchableTypePicker from '../shared/SearchableTypePicker';

type SearchablePokemonPickerProps = {
  value: string;
  options: SpeciesOption[];
  onSelect: (speciesName: string) => void;
  ariaLabel: string;
  placeholder?: string;
};

export default function SearchablePokemonPicker({
  value,
  options,
  onSelect,
  ariaLabel,
  placeholder = '— Select a Pokémon —',
}: SearchablePokemonPickerProps) {
  return (
    <SearchableTypePicker
      value={value}
      options={options}
      onSelect={onSelect}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      filterOptions={filterSpeciesOptions}
      getTypes={(option) => option.types}
      emptyMessage="No Pokémon found"
    />
  );
}
