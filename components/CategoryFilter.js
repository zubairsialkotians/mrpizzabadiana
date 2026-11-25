import React from 'react';
import { Chip, ChipRow } from './ui';

/*
  Categories and sub-categories. A sub-category is a category with parent_id set to a main category
  (one level only). Lists from older servers have no parent_id: everything is a main category.
*/

// [{ ...main, subs: [...] }] in the server's order
export function catTree(cats = []) {
  const ids = new Set(cats.map((c) => c.id));
  const mains = cats.filter((c) => !c.parent_id || !ids.has(c.parent_id));
  return mains.map((m) => ({ ...m, subs: cats.filter((c) => c.parent_id === m.id) }));
}

// The main category a selection belongs to (the selection itself when it is a main category)
export function mainOf(cats = [], id) {
  const c = cats.find((x) => x.id === id);
  return c?.parent_id && cats.some((x) => x.id === c.parent_id) ? c.parent_id : id;
}

// SelectField options: each main category followed by its subs ("Pizza › Large")
export function catOptions(cats = []) {
  const out = [];
  catTree(cats).forEach((m) => {
    out.push({ value: m.id, label: m.name, sub: m.subs.length ? `${m.subs.length} sub-categor${m.subs.length === 1 ? 'y' : 'ies'}` : undefined });
    m.subs.forEach((c) => out.push({ value: c.id, label: `${m.name} › ${c.name}` }));
  });
  return out;
}

// Row of sub-category chips for the chosen main category (nothing when it has none)
export function SubCategoryChips({ cats = [], value, onChange, style }) {
  const main = mainOf(cats, value);
  const m = main ? catTree(cats).find((x) => x.id === main) : null;
  if (!m?.subs.length) return null;
  return (
    <ChipRow style={style}>
      <Chip label={`All ${m.name}`} active={value === m.id} onPress={() => onChange(m.id)} />
      {m.subs.map((c) => <Chip key={c.id} label={c.name} active={value === c.id} onPress={() => onChange(c.id)} />)}
    </ChipRow>
  );
}

// Main category chips, then the chosen one's sub-categories underneath. value: category id (0 = all)
export function CategoryChips({ cats = [], value, onChange, allLabel = 'All', before }) {
  const main = mainOf(cats, value);
  return (
    <>
      <ChipRow>
        {before}
        <Chip label={allLabel} active={!value} onPress={() => onChange(0)} />
        {catTree(cats).map((c) => <Chip key={c.id} label={c.name} active={main === c.id} onPress={() => onChange(c.id)} />)}
      </ChipRow>
      <SubCategoryChips cats={cats} value={value} onChange={onChange} />
    </>
  );
}
