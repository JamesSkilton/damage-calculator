import { useState, useRef, useEffect, useId } from 'react';
import TypeBadges from './TypeBadges';
import './SearchableTypePicker.css';

type SearchableTypePickerProps<T extends { name: string }> = {
  value: string;
  options: T[];
  onSelect: (name: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** Filters options by search term; e.g. filterMoveOptions/filterSpeciesOptions. */
  filterOptions: (options: T[], searchTerm: string) => T[];
  /** Type(s) to render as badges for a given option. */
  getTypes: (option: T) => string[];
  /** Optional extra metadata rendered after the type badges (e.g. move base power). */
  renderExtra?: (option: T) => React.ReactNode;
  /** Optional extra class name applied to an option's <li> (e.g. "status-move"). */
  getOptionClassName?: (option: T) => string;
  emptyMessage?: string;
};

/**
 * Generic searchable combobox for selecting a named, typed option (a move or
 * a Pokémon species). Shows the option's type badge(s) both in the closed
 * "selected" chip and in each dropdown row, and lets the caller render
 * additional per-option metadata (e.g. a move's base power/status).
 */
export default function SearchableTypePicker<T extends { name: string }>({
  value,
  options,
  onSelect,
  ariaLabel,
  placeholder = '— Select —',
  filterOptions,
  getTypes,
  renderExtra,
  getOptionClassName,
  emptyMessage = 'No options found',
}: SearchableTypePickerProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const suppressFocusOpenRef = useRef(false);
  const listId = useId();

  const filteredOptions = filterOptions(options, searchTerm);

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

  const selectOption = (name: string) => {
    onSelect(name);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    suppressFocusOpenRef.current = true;
    inputRef.current?.focus();
  };

  const handleOptionClick = (name: string) => {
    selectOption(name);
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
    <div className="searchable-type-picker" ref={containerRef}>
      <div className="type-picker-input-wrapper">
        {showSelectedChip && selectedOption && (
          <div className="type-picker-selected-chip" aria-hidden="true">
            <div className="type-option-content">
              <span className="type-option-name">{selectedOption.name}</span>
              <div className="type-option-metadata">
                <TypeBadges types={getTypes(selectedOption)} />
                {renderExtra?.(selectedOption)}
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
          aria-controls={listId}
          className={`type-picker-input ${
            showSelectedChip ? 'type-picker-input-transparent' : ''
          }`}
        />
      </div>

      {isOpen && (
        <ul
          id={listId}
          ref={listRef}
          className="type-options-dropdown"
          role="listbox"
          aria-label={`${ariaLabel} options`}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li
                key={option.name}
                className={`type-option ${
                  highlightedIndex === index ? 'highlighted' : ''
                } ${getOptionClassName?.(option) ?? ''}`}
                role="option"
                aria-selected={value === option.name}
                onMouseEnter={() => handleOptionMouseEnter(index)}
                onClick={() => handleOptionClick(option.name)}
              >
                <div className="type-option-content">
                  <span className="type-option-name">{option.name}</span>
                  <div className="type-option-metadata">
                    <TypeBadges types={getTypes(option)} />
                    {renderExtra?.(option)}
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="type-option-empty" role="option" aria-disabled>
              {emptyMessage}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
