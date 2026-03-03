import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/providers/I18nProvider';
import type { MarketplaceInstalledRecord } from '@/api/types';
import { t } from '@/lib/i18n';
import { BrainCircuit, Check, ExternalLink, Search, Puzzle } from 'lucide-react';

type SkillsPickerProps = {
  records: MarketplaceInstalledRecord[];
  isLoading?: boolean;
  selectedSkills: string[];
  onSelectedSkillsChange: (next: string[]) => void;
};

export function SkillsPicker({ records, isLoading = false, selectedSkills, onSelectedSkillsChange }: SkillsPickerProps) {
  const { language } = useI18n();
  const [query, setQuery] = useState('');
  const selectedSkillSet = useMemo(() => new Set(selectedSkills), [selectedSkills]);
  const selectedCount = selectedSkills.length;
  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return records;
    }
    return records.filter((record) => {
      const haystack = [record.label, record.spec, record.description, record.descriptionZh]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [query, records]);

  const handleToggleSelection = (record: MarketplaceInstalledRecord) => {
    const skillName = record.spec?.trim();
    if (!skillName) {
      return;
    }
    if (selectedSkillSet.has(skillName)) {
      onSelectedSkillsChange(selectedSkills.filter((item) => item !== skillName));
      return;
    }
    onSelectedSkillsChange([...selectedSkills, skillName]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <BrainCircuit className="h-4 w-4" />
          <span>{t('chatSkillsPickerTitle')}</span>
          {selectedCount > 0 && (
            <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
              {selectedCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[360px] p-0">
        <div className="space-y-2 border-b border-gray-100 px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">{t('chatSkillsPickerTitle')}</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('chatSkillsPickerSearchPlaceholder')}
              className="h-8 rounded-lg pl-8 text-xs"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-4 text-xs text-gray-500">{t('sessionsLoading')}</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center">{t('chatSkillsPickerEmpty')}</div>
          ) : (
            <div className="py-1">
              {filteredRecords.map((record) => (
                <button
                  key={record.spec}
                  type="button"
                  onClick={() => handleToggleSelection(record)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <Puzzle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-gray-900">{record.label || record.spec}</span>
                      {record.origin === 'builtin' && (
                        <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          {t('chatSkillsPickerOfficial')}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gray-500">
                      {(language === 'zh' ? record.descriptionZh : record.description)?.trim() ||
                        record.description?.trim() ||
                        t('chatSkillsPickerNoDescription')}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0">
                    <span
                      className={
                        selectedSkillSet.has(record.spec)
                          ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white'
                          : 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white'
                      }
                    >
                      {selectedSkillSet.has(record.spec) && <Check className="h-3 w-3" />}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100">
          <NavLink
            to="/marketplace/skills"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {t('chatSkillsPickerManage')}
            <ExternalLink className="h-3 w-3" />
          </NavLink>
        </div>
      </PopoverContent>
    </Popover>
  );
}
