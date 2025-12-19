import React from 'react';
import { Category } from '../types';
import { Layers } from 'lucide-react';

interface CategorySelectorProps {
  selectedCategory: Category | null;
  onSelectCategory: (category: Category) => void;
  disabled?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  onSelectCategory,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-300">
        Select Category
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <Layers size={18} />
        </div>
        <select
          value={selectedCategory || ''}
          onChange={(e) => onSelectCategory(e.target.value as Category)}
          disabled={disabled}
          className="block w-full pl-10 pr-4 py-2.5 text-zinc-100 bg-zinc-900 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-zinc-900 disabled:text-zinc-600 transition-shadow shadow-sm placeholder-zinc-500"
        >
          <option value="" disabled className="text-zinc-500">
            Choose a processing category...
          </option>
          {Object.values(Category).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};