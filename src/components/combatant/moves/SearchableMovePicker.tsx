import { useState, useRef, useEffect } from 'react';
import type { MoveOption } from './moveOptions';
import { filterMoveOptions } from './moveOptions';
import { getMoveTypeColor, getMoveTypeIcon } from './moveTypeIcon';
import './SearchableMovePicker.css';

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
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const suppressFocusOpenRef = useRef(false);

  const filteredOptions = filterMoveOptions(options, searchTerm);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Reset search and highlighting when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Keep highlighted item in view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedItem = listRef.current.children[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setHighlightedIndex(-1);

    if (!isOpen && newSearchTerm.trim()) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (suppressFocusOpenRef.current) {
      suppressFocusOpenRef.current = false;
      return;
    }
    setIsOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      e.preventDefault();
      return;
    }

    if (!isOpen) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex].name);
        } else if (filteredOptions.length > 0) {
          selectOption(filteredOptions[0].name);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;

      default:
        break;
    }
  };

  const selectOption = (moveName: string) => {
    onSelect(moveName);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    suppressFocusOpenRef.current = true;
    inputRef.current?.focus();
  };

  const handleOptionClick = (moveName: string) => {
    selectOption(moveName);
  };

  const handleOptionMouseEnter = (index: number) => {
    setHighlightedIndex(index);
  };

  const displayValue = value || placeholder;
  const selectedOption = value
    ? options.find((option) => option.name === value)
    : undefined;
  const showSelectedChip = !isOpen && !searchTerm && !!selectedOption;

  return (
    <div className="searchable-move-picker" ref={containerRef}>
      <div className="move-picker-input-wrapper">
        {showSelectedChip && selectedOption && (
          <div className="move-picker-selected-chip" aria-hidden="true">
            <div className="move-option-content">
              <span className="move-name">{selectedOption.name}</span>
              <div className="move-metadata">
                <span
                  className="move-type-icon"
                  title={selectedOption.type}
                  style={{
                    backgroundColor: getMoveTypeColor(selectedOption.type),
                  }}
                >
                  {getMoveTypeIcon(selectedOption.type) ? (
                    <img
                      className="move-type-icon-img"
                      src={getMoveTypeIcon(selectedOption.type)}
                      alt=""
                    />
                  ) : (
                    <span className="move-type-icon-fallback">
                      {selectedOption.type.slice(0, 1)}
                    </span>
                  )}
                </span>
                {selectedOption.basePower > 0 ? (
                  <span className="move-base-power">
                    BP: {selectedOption.basePower}
                  </span>
                ) : (
                  <span className="move-status-indicator">Status</span>
                )}
              </div>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm || displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="move-options-list"
          className={`move-picker-input ${
            showSelectedChip ? 'move-picker-input-transparent' : ''
          }`}
        />
      </div>

      {isOpen && (
        <ul
          id="move-options-list"
          ref={listRef}
          className="move-options-dropdown"
          role="listbox"
          aria-label={`${ariaLabel} options`}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li
                key={option.name}
                className={`move-option ${
                  highlightedIndex === index ? 'highlighted' : ''
                } ${option.basePower === 0 ? 'status-move' : ''}`}
                role="option"
                aria-selected={value === option.name}
                onMouseEnter={() => handleOptionMouseEnter(index)}
                onClick={() => handleOptionClick(option.name)}
              >
                <div className="move-option-content">
                  <span className="move-name">{option.name}</span>
                  <div className="move-metadata">
                    <span
                      className="move-type-icon"
                      role="img"
                      aria-label={option.type}
                      title={option.type}
                      style={{ backgroundColor: getMoveTypeColor(option.type) }}
                    >
                      {getMoveTypeIcon(option.type) ? (
                        <img
                          className="move-type-icon-img"
                          src={getMoveTypeIcon(option.type)}
                          alt=""
                          aria-hidden="true"
                        />
                      ) : (
                        <span
                          className="move-type-icon-fallback"
                          aria-hidden="true"
                        >
                          {option.type.slice(0, 1)}
                        </span>
                      )}
                    </span>
                    {option.basePower > 0 && (
                      <span className="move-base-power">
                        BP: {option.basePower}
                      </span>
                    )}
                    {option.basePower === 0 && (
                      <span className="move-status-indicator">Status</span>
                    )}
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="move-option-empty" role="option" aria-disabled>
              No moves found
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
