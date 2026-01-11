// ================= TYPES =================
export enum ChannelType {
    TELEGRAM = 'telegram',
    WHATSAPP = 'whatsapp',
    GMAIL = 'gmail',
    PROTON = 'proton'
}

export interface ContactChannel {
    type: ChannelType;
    label: string;
    enabled: boolean;
    placeholder: string;
    iconMode?: 'default' | 'custom';
    customIconUrl?: string;
}

export type WidgetPanelStyle = 'classic' | 'monochrome' | 'glass' | 'dark' | 'brutalist' | 'ocean';

export interface WidgetConfig {
    id: string;
    name: string;
    title: string;
    description: string;
    channels: ContactChannel[];
    themeColor: string;
    position: 'bottom-right' | 'bottom-left';
    createdAt: number;
    botToken?: string;
    chatId?: string;
    widgetIconMode?: 'default' | 'custom';
    customWidgetIconUrl?: string;
    widgetSize?: number;
    widgetOutlineWidth?: number;
    widgetOutlineColor?: string;
    widgetBorderRadius?: number;
    backgroundType?: 'solid' | 'gradient';
    themeGradient?: string;
    panelStyle?: WidgetPanelStyle;
    panelWidth?: number;
    descriptionRows?: number;
    headerBgOverride?: string;
    headerTextOverride?: string;
    bodyBgOverride?: string;
    cardBgOverride?: string;
    cardTextOverride?: string;
}

// ================= CONSTANTS =================
export const DEFAULT_CHANNELS: ContactChannel[] = [
    { type: ChannelType.TELEGRAM, label: 'Telegram', enabled: true, placeholder: 'username', iconMode: 'default' },
    { type: ChannelType.WHATSAPP, label: 'WhatsApp', enabled: true, placeholder: '79001234567', iconMode: 'default' },
    { type: ChannelType.GMAIL, label: 'Gmail', enabled: true, placeholder: 'yourname', iconMode: 'default' },
    { type: ChannelType.PROTON, label: 'Proton Mail', enabled: true, placeholder: 'yourname', iconMode: 'default' }
];

export const PRESET_GRADIENTS = [
    'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    'linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
    'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
];

export const PRESET_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f43f5e', '#8b5cf6', '#1e293b', '#ffffff', '#000000'];

export const INITIAL_WIDGET: WidgetConfig = {
    id: 'w-' + Math.random().toString(36).substr(2, 9),
    name: 'Default Widget',
    title: 'Need help?',
    description: 'Choose your preferred contact method and we will get back to you.',
    channels: [...DEFAULT_CHANNELS],
    themeColor: '#4f46e5',
    position: 'bottom-right',
    createdAt: Date.now(),
    widgetIconMode: 'default',
    widgetSize: 64,
    widgetOutlineWidth: 0,
    widgetOutlineColor: '#000000',
    widgetBorderRadius: 24,
    backgroundType: 'solid',
    themeGradient: PRESET_GRADIENTS[0],
    panelStyle: 'classic',
    panelWidth: 340,
    descriptionRows: 2
};

// ================= HELPERS =================
const CHANNEL_ICONS: Record<ChannelType, string> = {
    [ChannelType.TELEGRAM]: 'fa-brands fa-telegram',
    [ChannelType.WHATSAPP]: 'fa-brands fa-whatsapp',
    [ChannelType.GMAIL]: 'fa-solid fa-envelope',
    [ChannelType.PROTON]: 'fa-solid fa-shield-halved'
};

const CHANNEL_COLORS: Record<ChannelType, string> = {
    [ChannelType.TELEGRAM]: 'bg-sky-500',
    [ChannelType.WHATSAPP]: 'bg-emerald-500',
    [ChannelType.GMAIL]: 'bg-red-500',
    [ChannelType.PROTON]: 'bg-purple-600'
};

export const getChannelIcon = (type: ChannelType) => CHANNEL_ICONS[type] || 'fa-solid fa-question';
export const getChannelColor = (type: ChannelType) => CHANNEL_COLORS[type] || 'bg-slate-500';

export const formatFinalValue = (type: ChannelType, input: string): string => {
    const clean = input.trim();
    switch (type) {
        case ChannelType.GMAIL: return `${clean}@gmail.com`;
        case ChannelType.PROTON: return `${clean}@proton.me`;
        case ChannelType.TELEGRAM: return `@${clean.replace('@', '')}`;
        case ChannelType.WHATSAPP: return `+${clean.replace(/\D/g, '')}`;
        default: return clean;
    }
};
