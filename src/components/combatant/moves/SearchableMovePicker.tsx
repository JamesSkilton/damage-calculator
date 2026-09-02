import type { MoveOption } from './moveOptions';
import { filterMoveOptions } from './moveOptions';
import SearchableTypePicker from '../shared/SearchableTypePicker';

type SearchableMovePickerProps = {
  value: string;
  options: MoveOption[];
  onSelect: (moveName: string) => void;
  ariaLabel: string;
  placeholder?: string;
};

export default function SearchableMovePicker({
  value,
  options,
  onSelect,
  ariaLabel,
  placeholder = '— Select move —',
}: SearchableMovePickerProps) {
  return (
    <SearchableTypePicker
      value={value}
      options={options}
      onSelect={onSelect}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      filterOptions={filterMoveOptions}
      getTypes={(option) => [option.type]}
      getOptionClassName={(option) =>
        option.basePower === 0 ? 'status-move' : ''
      }
      renderExtra={(option) =>
        option.basePower > 0 ? (
          <span className="move-base-power">BP: {option.basePower}</span>
        ) : (
          <span className="move-status-indicator">Status</span>
        )
      }
      emptyMessage="No moves found"
    />
  );
}
