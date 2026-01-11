
import { useState, FC, CSSProperties } from 'react';
import { WidgetConfig, ChannelType, ContactChannel, getChannelIcon, getChannelColor, formatFinalValue } from '../config.ts';
import SmartInput from './SmartInput.tsx';
import { simulateTelegramSubmission } from '../services/geminiService.ts';
import { sendTelegramMessage } from '../services/telegramService.ts';


declare global {
  interface Window {
    WIDGET_CONFIG?: WidgetConfig;
  }
}

interface WidgetProps {
  config?: WidgetConfig;
  isPreview?: boolean;
}

const Widget: FC<WidgetProps> = ({ config: propConfig, isPreview = false }) => {
  const config = propConfig || window.WIDGET_CONFIG;
  if (!config) return null;
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [messageValue, setMessageValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledChannels = config.channels.filter(c => c.enabled);
  const buttonSize = config.widgetSize || 64;
  const iconSizeMultiplier = buttonSize / 64;

  const isBackgroundWhite = config.backgroundType === 'solid' && (config.themeColor.toLowerCase() === '#ffffff' || config.themeColor.toLowerCase() === 'white');
  const triggerIconColor = isBackgroundWhite ? '#000000' : '#ffffff';

  const panelStyle = config.panelStyle || 'classic';

  let panelBgClass = "bg-white border-slate-100";
  let headerStyle: CSSProperties = {};
  let headerTextClass = "text-white";
  let bodyTextClass = "text-slate-600";
  let titleTextClass = "text-white font-extrabold";
  let closeBtnClass = "bg-white/20 text-white hover:bg-white/30";
  let cardClass = "bg-slate-50 border-slate-100 hover:bg-indigo-50";
  let bodyContainerStyle: CSSProperties = {};
  let panelBorderRadius = "2rem";

  // Preset Selection Logic
  if (panelStyle === 'monochrome') {
    panelBgClass = "bg-white border-slate-200";
    headerStyle = { background: '#1e293b' };
    headerTextClass = "text-slate-300";
    bodyTextClass = "text-slate-600";
    titleTextClass = "text-white font-black uppercase tracking-tight";
    closeBtnClass = "bg-slate-800 text-slate-400 hover:text-white";
    cardClass = "bg-white border-slate-200 hover:border-slate-900 grayscale transition-all";
  } else if (panelStyle === 'glass') {
    panelBgClass = "bg-white/70 backdrop-blur-xl border-white/40 shadow-2xl";
    headerStyle = { background: 'transparent' };
    headerTextClass = "text-slate-600";
    bodyTextClass = "text-slate-700";
    titleTextClass = "text-slate-900 font-black";
    closeBtnClass = "bg-black/5 text-slate-500 hover:bg-black/10";
    cardClass = "bg-white/40 border-white/60 hover:bg-white/80 backdrop-blur-sm";
  } else if (panelStyle === 'dark') {
    panelBgClass = "bg-slate-900 border-slate-800 shadow-2xl shadow-black/50";
    headerStyle = { background: 'transparent', borderBottom: '1px solid #334155' };
    headerTextClass = "text-slate-400";
    bodyTextClass = "text-slate-400";
    titleTextClass = "text-white font-black uppercase";
    closeBtnClass = "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white";
    cardClass = "bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-indigo-500/50";
  } else if (panelStyle === 'brutalist') {
    panelBgClass = "bg-white border-[4px] border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]";
    headerStyle = { background: '#facc15', borderBottom: '4px solid black' };
    headerTextClass = "text-black";
    bodyTextClass = "text-black";
    titleTextClass = "text-black font-black uppercase italic text-2xl";
    closeBtnClass = "bg-black text-white hover:bg-black/80";
    cardClass = "bg-white border-[3px] border-black hover:bg-indigo-400 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all";
    panelBorderRadius = "0";
  } else if (panelStyle === 'ocean') {
    panelBgClass = "bg-sky-50 border-sky-100 shadow-2xl shadow-sky-900/20";
    headerStyle = { background: 'linear-gradient(135deg, #075985 0%, #0369a1 100%)' };
    headerTextClass = "text-sky-100";
    bodyTextClass = "text-sky-800";
    titleTextClass = "text-white font-black tracking-widest uppercase";
    closeBtnClass = "bg-white/10 text-white hover:bg-white/20";
    cardClass = "bg-white border-sky-100 hover:border-sky-300 shadow-sm hover:shadow-sky-100 transition-all";
  } else {
    headerStyle = { background: config.backgroundType === 'gradient' ? config.themeGradient : config.themeColor };
    if (isBackgroundWhite) {
      headerTextClass = "text-slate-500";
      titleTextClass = "text-slate-900 font-extrabold";
      closeBtnClass = "bg-slate-100 text-slate-400 hover:bg-slate-200";
    }
  }

  // Apply manual fine-tuning overrides if present
  if (config.headerBgOverride) headerStyle = { ...headerStyle, background: config.headerBgOverride };
  if (config.headerTextOverride) headerTextClass = ""; // Clear class to use style
  if (config.bodyBgOverride) bodyContainerStyle = { ...bodyContainerStyle, background: config.bodyBgOverride };

  const headerTextStyle: CSSProperties = config.headerTextOverride ? { color: config.headerTextOverride } : {};
  const cardItemStyle: CSSProperties = {
    background: config.cardBgOverride || undefined,
    color: config.cardTextOverride || undefined
  };

  const handleSelectChannel = (type: ChannelType) => {
    setSelectedChannel(type);
    setInputValue(type === ChannelType.TELEGRAM ? '@' : '');
    setStep(2);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedChannel || !inputValue || inputValue === '@') return;
    // Если поле сообщения включено, но пустое - не отправляем
    if (config.showMessageField !== false && !messageValue.trim()) {
      setError('Please enter a message');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const finalVal = formatFinalValue(selectedChannel, inputValue);
    const message = config.showMessageField !== false ? messageValue : '';
    try {
      if (config.botToken && config.chatId && !isPreview) {
        await sendTelegramMessage(config.botToken, config.chatId, config.name, selectedChannel, finalVal, message);
      } else {
        await simulateTelegramSubmission(config.name, selectedChannel, finalVal);
      }
      setIsSuccess(true);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetWidget = () => {
    setStep(1);
    setSelectedChannel(null);
    setInputValue('');
    setMessageValue('');
    setIsSuccess(false);
    setError(null);
  };

  const renderChannelIcon = (channel: ContactChannel) => {
    if (channel.iconMode === 'custom' && channel.customIconUrl) {
      return (
        <img src={channel.customIconUrl} alt={channel.label} className="w-8 h-8 object-contain rounded" />
      );
    }
    return <i className={getChannelIcon(channel.type)}></i>;
  };

  const renderMainIcon = () => {
    if (isOpen) {
      return (
        <i className="fa-solid fa-xmark transition-transform duration-500 rotate-90" style={{ fontSize: `${24 * iconSizeMultiplier}px`, color: triggerIconColor }}></i>
      );
    }
    if (config.widgetIconMode === 'custom' && config.customWidgetIconUrl) {
      return (
        <img src={config.customWidgetIconUrl} alt="Contact Us" className="object-contain animate-in zoom-in-50 duration-300" style={{ width: `${40 * iconSizeMultiplier}px`, height: `${40 * iconSizeMultiplier}px` }} />
      );
    }
    return (
      <i className="fa-solid fa-comments transition-transform duration-500" style={{ fontSize: `${24 * iconSizeMultiplier}px`, color: triggerIconColor }}></i>
    );
  };

  const triggerStyles: CSSProperties = {
    background: config.backgroundType === 'gradient' ? config.themeGradient : config.themeColor,
    width: `${buttonSize}px`,
    height: `${buttonSize}px`,
    borderRadius: panelStyle === 'brutalist' ? '0' : `${config.widgetBorderRadius ?? buttonSize / 2.6}px`,
    border: panelStyle === 'brutalist' ? '3px solid black' : (config.widgetOutlineWidth ? `${config.widgetOutlineWidth}px solid ${config.widgetOutlineColor}` : (isBackgroundWhite ? '1px solid #e2e8f0' : 'none')),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: panelStyle === 'brutalist' ? '6px 6px 0px 0px rgba(0,0,0,1)' : undefined
  };

  const descriptionStyle: CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: config.descriptionRows || 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    ...(config.headerTextOverride ? { color: config.headerTextOverride, opacity: 0.8 } : {})
  };

  return (
    <div className={`fixed bottom-8 right-8 z-[100] flex flex-col items-end`}>
      {isOpen && (
        <div
          className={`mb-4 overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-6 duration-500 ease-out ${panelBgClass}`}
          style={{ width: `${config.panelWidth || 340}px`, borderRadius: panelBorderRadius }}
        >
          <div className="p-6 pb-8" style={headerStyle}>
            <div className={`flex justify-between items-start`}>
              <div>
                <h3 className={`text-xl tracking-tight mb-1 truncate ${titleTextClass}`} style={headerTextStyle}>{config.title}</h3>
                <p
                  className={`text-sm leading-relaxed ${headerTextClass}`}
                  style={descriptionStyle}
                >
                  {config.description}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-2 ${closeBtnClass}`}>
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          </div>

          <div
            className={`px-6 py-8 min-h-[260px] flex flex-col -mt-4 rounded-t-3xl ${panelStyle === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
            style={bodyContainerStyle}
          >
            {step === 1 && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                {enabledChannels.length > 0 ? enabledChannels.map(channel => (
                  <button
                    key={channel.type}
                    onClick={() => handleSelectChannel(channel.type)}
                    className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all group ${cardClass}`}
                    style={cardItemStyle}
                  >
                    <div className={`w-12 h-12 rounded-2xl ${getChannelColor(channel.type)} text-white flex items-center justify-center text-xl mb-3 shadow-md group-hover:scale-110 transition-transform overflow-hidden`}>
                      {renderChannelIcon(channel)}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.1em] truncate w-full px-1 ${panelStyle === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} style={config.cardTextOverride ? { color: config.cardTextOverride } : {}}>{channel.label}</span>
                  </button>
                )) : (
                  <div className="col-span-2 py-10 text-center opacity-40 text-xs font-medium text-slate-400">
                    Enable channels in the editor to see them here.
                  </div>
                )}
              </div>
            )}

            {step === 2 && selectedChannel && (
              <div className="animate-in slide-in-from-right-8 duration-500 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setStep(1)} className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${panelStyle === 'dark' ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                    <i className="fa-solid fa-chevron-left text-xs"></i>
                  </button>
                  <span className={`text-sm font-bold uppercase tracking-tight ${panelStyle === 'dark' ? 'text-slate-300' : (panelStyle === 'brutalist' ? 'text-black' : 'text-slate-800')}`} style={config.cardTextOverride ? { color: config.cardTextOverride } : {}}>{selectedChannel}</span>
                </div>

                <div className={`${panelStyle === 'dark' ? 'dark-input' : ''}`}>
                  <SmartInput
                    type={selectedChannel}
                    value={inputValue}
                    onChange={setInputValue}
                    placeholder={config.channels.find(c => c.type === selectedChannel)?.placeholder}
                  />
                </div>

                {/* Message field - conditionally rendered */}
                {config.showMessageField !== false && (
                  <div className="mt-3">
                    <textarea
                      rows={3}
                      value={messageValue}
                      onChange={(e) => setMessageValue(e.target.value)}
                      placeholder={config.messagePlaceholder || 'How can we help?'}
                      className={`w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none ${panelStyle === 'dark'
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500'
                          : panelStyle === 'brutalist'
                            ? 'bg-white border-[2px] border-black focus:ring-0'
                            : 'bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'
                        }`}
                    />
                  </div>
                )}

                {error && (
                  <p className="text-red-500 text-xs mt-3 font-medium flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation"></i> {error}
                  </p>
                )}

                <div className="mt-auto pt-8">
                  <button
                    onClick={handleSubmit}
                    disabled={!inputValue || inputValue === '@' || isSubmitting}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 ${panelStyle === 'dark' ? 'shadow-lg shadow-black/20' : (panelStyle === 'brutalist' ? 'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'shadow-xl')}`}
                    style={{ background: config.backgroundType === 'gradient' ? config.themeGradient : config.themeColor }}
                  >
                    {isSubmitting ? (
                      <i className="fa-solid fa-spinner fa-spin text-white"></i>
                    ) : (
                      <div className={`flex items-center gap-3 ${isBackgroundWhite ? 'text-slate-900' : 'text-white'}`}>
                        <span>Submit Now</span>
                        <i className="fa-solid fa-paper-plane text-xs"></i>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && isSuccess && (
              <div className="animate-in zoom-in-95 duration-500 flex-1 flex flex-col items-center justify-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm border ${panelStyle === 'dark' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
                  <i className="fa-solid fa-check"></i>
                </div>
                <h4 className={`font-black text-xl mb-2 ${panelStyle === 'dark' ? 'text-white' : (panelStyle === 'brutalist' ? 'text-black font-black italic' : 'text-slate-900')}`}>Message Sent!</h4>
                <p className={`text-sm max-w-[200px] leading-relaxed ${bodyTextClass}`} style={config.cardTextOverride ? { color: config.cardTextOverride } : {}}>Our team has been notified. We'll be in touch very soon.</p>

                <button
                  onClick={resetWidget}
                  className={`mt-8 px-6 py-2.5 rounded-full border text-xs font-bold uppercase tracking-widest transition-all ${panelStyle === 'dark' ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : (panelStyle === 'brutalist' ? 'border-black border-[2px] text-black font-black' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}`}
                >
                  Send Another
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="transition-all hover:scale-110 active:scale-90 z-[110] hover:rotate-3 overflow-hidden flex items-center justify-center"
        style={triggerStyles}
      >
        {renderMainIcon()}
      </button>
    </div>
  );
};

export default Widget;
