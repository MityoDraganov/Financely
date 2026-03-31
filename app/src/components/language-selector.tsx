import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Languages } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type LanguageSelectorProps = {
  fullWidth?: boolean;
  triggerClassName?: string;
};

export function LanguageSelector({ fullWidth = false, triggerClassName }: LanguageSelectorProps = {}) {
  const { i18n } = useTranslation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'bg', name: 'Български', flag: '🇧🇬' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem('i18nextLng', languageCode);
  };

  return (
    <Select value={i18n.language} onValueChange={handleLanguageChange}>
      <SelectTrigger
        className={cn(
          "h-9 rounded-sm",
          isCollapsed
            ? "w-9 px-0 justify-center [&>svg]:hidden"
            : fullWidth
              ? "w-full justify-between"
              : "w-fit",
          triggerClassName
        )}
      >
        {isCollapsed ? (
          <span className="text-lg leading-none flex items-center justify-center">{currentLanguage.flag}</span>
        ) : (
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 shrink-0" />
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <span>{currentLanguage.flag}</span>
                <span className="inline">{currentLanguage.name}</span>
              </span>
            </SelectValue>
          </div>
        )}
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
