import { useState, useEffect, useRef, FC, ChangeEvent } from 'react';
import { WidgetConfig, ChannelType, ContactChannel, WidgetPanelStyle, INITIAL_WIDGET, getChannelIcon, PRESET_GRADIENTS, PRESET_COLORS } from '../config.ts';
import Widget from './Widget.tsx';
import { getWidgetAIAssistance } from '../services/geminiService.ts';

const AdminPanel: FC = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [activeWidget, setActiveWidget] = useState<WidgetConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'security' | 'embed'>('editor');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelType | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelFileRef = useRef<HTMLInputElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('multi_contact_widgets');
    if (saved) {
      const parsed = JSON.parse(saved);
      setWidgets(parsed);
      if (parsed.length > 0) setActiveWidget(parsed[0]);
    } else {
      const initial = { ...INITIAL_WIDGET };
      setWidgets([initial]);
      setActiveWidget(initial);
      localStorage.setItem('multi_contact_widgets', JSON.stringify([initial]));
    }
  }, []);

  const saveWidgets = (updated: WidgetConfig[]) => {
    setWidgets(updated);
    localStorage.setItem('multi_contact_widgets', JSON.stringify(updated));
  };

  const updateActiveWidget = (changes: Partial<WidgetConfig>) => {
    if (!activeWidget) return;
    const updated = { ...activeWidget, ...changes };
    setActiveWidget(updated);
    const updatedList = widgets.map(w => w.id === updated.id ? updated : w);
    saveWidgets(updatedList);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, target: 'widget' | 'channel') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (target === 'widget') {
        updateActiveWidget({
          widgetIconMode: 'custom',
          customWidgetIconUrl: base64String
        });
      } else if (target === 'channel' && editingChannel) {
        const channels = activeWidget!.channels.map(c =>
          c.type === editingChannel ? { ...c, iconMode: 'custom', customIconUrl: base64String } : c
        );
        updateActiveWidget({ channels });
      }
    };
    reader.readAsDataURL(file);
  };

  const updateChannel = (type: ChannelType, changes: Partial<ContactChannel>) => {
    if (!activeWidget) return;
    const channels = activeWidget.channels.map(c =>
      c.type === type ? { ...c, ...changes } : c
    );
    updateActiveWidget({ channels });
  };

  const toggleChannel = (type: ChannelType) => {
    if (!activeWidget) return;
    const channels = activeWidget.channels.map(c =>
      c.type === type ? { ...c, enabled: !c.enabled } : c
    );
    updateActiveWidget({ channels });
  };

  const handleAIAssist = async () => {
    if (!activeWidget) return;
    setIsLoadingAI(true);
    const suggestion = await getWidgetAIAssistance(activeWidget.description);
    if (suggestion) {
      updateActiveWidget({ title: suggestion.titles[0], description: suggestion.description });
    }
    setIsLoadingAI(false);
  };

  const createNewWidget = () => {
    const next = { ...INITIAL_WIDGET, id: 'w-' + Math.random().toString(36).substr(2, 9), name: 'New Hub ' + (widgets.length + 1) };
    const updated = [...widgets, next];
    setWidgets(updated);
    setActiveWidget(next);
    saveWidgets(updated);
  };

  const deleteWidget = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this widget?')) return;
    const updated = widgets.filter(w => w.id !== id);
    setWidgets(updated);
    if (activeWidget?.id === id) {
      setActiveWidget(updated[0] || null);
    }
    saveWidgets(updated);
  };

  const handleExportProject = () => {
    if (!activeWidget) return;
    const blob = new Blob([JSON.stringify(activeWidget, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hub-project-${activeWidget.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.warn('Import: No file selected');
      return;
    }

    // Проверка размера файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Maximum size is 5MB.');
      e.target.value = '';
      return;
    }

    // Проверка типа файла
    if (!file.name.endsWith('.json')) {
      alert('Please select a valid JSON file (.json extension required).');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      console.error('Import Error: FileReader failed', reader.error);
      alert('Failed to read the file. Please try again.');
      e.target.value = '';
    };

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;

        if (!content || content.trim().length === 0) {
          throw new Error('File is empty');
        }

        console.log('Import: Parsing JSON content...');
        const importedConfig = JSON.parse(content) as WidgetConfig;

        // Валидация обязательных полей
        if (!importedConfig.id) {
          throw new Error('Missing required field: id');
        }
        if (!importedConfig.name) {
          throw new Error('Missing required field: name');
        }
        if (!Array.isArray(importedConfig.channels)) {
          throw new Error('Invalid or missing channels array');
        }

        // Создаем новый виджет с уникальным ID
        const newItem: WidgetConfig = {
          ...importedConfig,
          id: 'w-' + Math.random().toString(36).substr(2, 9),
          createdAt: Date.now(),
          name: importedConfig.name + ' (Imported)'
        };

        console.log('Import: Successfully parsed config:', newItem.name);

        const updated = [...widgets, newItem];
        setWidgets(updated);
        setActiveWidget(newItem);
        saveWidgets(updated);

        alert(`✅ Project "${importedConfig.name}" imported successfully!`);
      } catch (err) {
        console.error('Import Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        alert(`❌ Failed to import project.\n\nReason: ${errorMessage}\n\nPlease ensure you are importing a valid Hub project JSON file.`);
      } finally {
        // Сброс input для возможности повторного выбора того же файла
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // --- ГЕНЕРАТОР КОДА: ПОЛНОСТЬЮ СИНХРОНИЗИРОВАННЫЙ С WIDGET.TSX ---
  const generateWidgetScript = (config: WidgetConfig, isPreview = false) => {
    const configString = JSON.stringify(config);
    const base64Config = btoa(unescape(encodeURIComponent(configString)));
    const initDelay = isPreview ? 50 : 500;

    return `
(function() {
  try {
    var rawConfig = "${base64Config}";
    var config = JSON.parse(decodeURIComponent(escape(atob(rawConfig))));
    
    // --- Styles Loader ---
    if (!document.querySelector('link[href*="font-awesome"]')) {
      var fa = document.createElement('link'); fa.rel = 'stylesheet';
      fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(fa);
    }
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      var tw = document.createElement('script'); tw.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(tw);
    }

    var root = document.createElement('div');
    root.id = 'feedback-hub-root';
    document.body.appendChild(root);

    // --- Style Logic (Synced with Widget.tsx) ---
    var panelStyle = config.panelStyle || 'classic';
    var isBackgroundWhite = config.backgroundType === 'solid' && (config.themeColor.toLowerCase() === '#ffffff' || config.themeColor.toLowerCase() === 'white');
    
    // Defaults
    var panelBgClass = "bg-white border-slate-100";
    var headerBgStyle = config.backgroundType === 'gradient' ? config.themeGradient : config.themeColor;
    var headerBorderBottom = 'none';
    var headerTextClass = "text-white";
    var bodyTextClass = "text-slate-600";
    var titleTextClass = "text-white font-extrabold";
    var closeBtnClass = "bg-white/20 text-white hover:bg-white/30";
    var cardClass = "bg-slate-50 border-slate-100 hover:bg-indigo-50";
    var bodyContainerBg = config.bodyBgOverride || '#f8fafc';
    var panelBorderRadius = "2rem";
    var triggerIconColor = isBackgroundWhite ? '#000000' : '#ffffff';
    var triggerBorder = (config.widgetOutlineWidth ? config.widgetOutlineWidth + 'px solid ' + config.widgetOutlineColor : (isBackgroundWhite ? '1px solid #e2e8f0' : 'none'));
    var triggerShadow = '';

    // Preset Overrides
    if (panelStyle === 'monochrome') {
        panelBgClass = "bg-white border-slate-200";
        headerBgStyle = '#1e293b';
        headerTextClass = "text-slate-300";
        bodyTextClass = "text-slate-600";
        titleTextClass = "text-white font-black uppercase tracking-tight";
        closeBtnClass = "bg-slate-800 text-slate-400 hover:text-white";
        cardClass = "bg-white border-slate-200 hover:border-slate-900 grayscale transition-all";
    } else if (panelStyle === 'glass') {
        panelBgClass = "bg-white/70 backdrop-blur-xl border-white/40 shadow-2xl";
        headerBgStyle = 'transparent';
        headerTextClass = "text-slate-600";
        bodyTextClass = "text-slate-700";
        titleTextClass = "text-slate-900 font-black";
        closeBtnClass = "bg-black/5 text-slate-500 hover:bg-black/10";
        cardClass = "bg-white/40 border-white/60 hover:bg-white/80 backdrop-blur-sm";
    } else if (panelStyle === 'dark') {
        panelBgClass = "bg-slate-900 border-slate-800 shadow-2xl shadow-black/50";
        headerBgStyle = 'transparent'; 
        headerBorderBottom = '1px solid #334155';
        headerTextClass = "text-slate-400";
        bodyTextClass = "text-slate-400";
        titleTextClass = "text-white font-black uppercase";
        closeBtnClass = "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white";
        cardClass = "bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-indigo-500/50";
        bodyContainerBg = 'transparent'; 
    } else if (panelStyle === 'brutalist') {
        panelBgClass = "bg-white border-[4px] border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]";
        headerBgStyle = '#facc15';
        headerBorderBottom = '4px solid black';
        headerTextClass = "text-black";
        bodyTextClass = "text-black";
        titleTextClass = "text-black font-black uppercase italic text-2xl";
        closeBtnClass = "bg-black text-white hover:bg-black/80";
        cardClass = "bg-white border-[3px] border-black hover:bg-indigo-400 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all";
        panelBorderRadius = "0";
        triggerBorder = '3px solid black';
        triggerShadow = '6px 6px 0px 0px rgba(0,0,0,1)';
    } else if (panelStyle === 'ocean') {
        panelBgClass = "bg-sky-50 border-sky-100 shadow-2xl shadow-sky-900/20";
        headerBgStyle = 'linear-gradient(135deg, #075985 0%, #0369a1 100%)';
        headerTextClass = "text-sky-100";
        bodyTextClass = "text-sky-800";
        titleTextClass = "text-white font-black tracking-widest uppercase";
        closeBtnClass = "bg-white/10 text-white hover:bg-white/20";
        cardClass = "bg-white border-sky-100 hover:border-sky-300 shadow-sm hover:shadow-sky-100 transition-all";
    } else {
        // Classic Fallback modifications
        if (isBackgroundWhite) {
            headerTextClass = "text-slate-500";
            titleTextClass = "text-slate-900 font-extrabold";
            closeBtnClass = "bg-slate-100 text-slate-400 hover:bg-slate-200";
        }
    }

    // Manual Overrides
    if (config.headerBgOverride) headerBgStyle = config.headerBgOverride;
    if (config.headerTextOverride) headerTextClass = ""; // Clear class to use explicit style in future if needed, but for now we just rely on style attr
    var headerTextStyle = config.headerTextOverride ? ('color: ' + config.headerTextOverride + '; opacity: 0.8;') : '';

    // --- Helpers ---
    var getIconClass = function(type) {
        if (type === 'gmail') return 'fa-brands fa-google';
        if (type === 'proton') return 'fa-solid fa-envelope';
        if (type === 'telegram') return 'fa-brands fa-telegram';
        if (type === 'whatsapp') return 'fa-brands fa-whatsapp';
        return 'fa-brands fa-' + type;
    };

    var getChannelColor = function(type) {
        if (type === 'telegram') return 'bg-sky-500';
        if (type === 'whatsapp') return 'bg-emerald-500';
        if (type === 'gmail') return 'bg-red-500';
        if (type === 'proton') return 'bg-purple-600';
        return 'bg-slate-500';
    };

    setTimeout(function() {
      try {
        var channelsHtml = config.channels.filter(function(c) { return c.enabled; }).map(function(c) {
            return \`
              <button onclick="window.hubGoToStep2('\${c.type}')" 
                 class="flex flex-col items-center justify-center p-5 rounded-2xl border transition-all group \${cardClass}"
                 style="aspect-ratio: 1 / 1; min-height: 100px;">
                 <div class="w-12 h-12 rounded-2xl \${getChannelColor(c.type)} text-white flex items-center justify-center text-xl mb-3 shadow-md group-hover:scale-110 transition-transform overflow-hidden">
                    \${c.iconMode === 'custom' && c.customIconUrl 
                        ? \`<img src="\${c.customIconUrl}" class="w-full h-full object-cover">\`
                        : \`<i class="\${getIconClass(c.type)}"></i>\`
                    }
                 </div>
                 <span class="text-[10px] font-bold uppercase tracking-wider w-full truncate px-1 \${(panelStyle === 'brutalist' || panelStyle === 'monochrome') ? 'text-slate-400' : 'text-slate-400'}">\${c.label}</span>
              </button>
            \`;
        }).join('');

        root.innerHTML = \`
          <div style="position:fixed; bottom:20px; right:20px; z-index:2147483647; font-family: sans-serif;">
            
            <button id="hub-trigger" class="shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center cursor-pointer" 
                    style="width:\${config.widgetSize}px; height:\${config.widgetSize}px; border-radius:\${panelStyle === 'brutalist' ? '0' : (config.widgetBorderRadius || 999)}px; background:\${config.backgroundType === 'gradient' ? config.themeGradient : config.themeColor}; color:\${triggerIconColor}; border:\${triggerBorder}; box-shadow:\${triggerShadow}">
              \${config.widgetIconMode === 'custom' && config.customWidgetIconUrl 
                ? \`<img src="\${config.customWidgetIconUrl}" style="width:50%; height:50%; object-fit:contain;">\`
                : \`<i class="fa-solid fa-comments" style="font-size:24px;"></i>\`
              }
            </button>

            <div id="hub-panel" class="hidden absolute bottom-full right-0 mb-4 rounded-3xl overflow-hidden flex flex-col \${panelBgClass}" 
                 style="width:\${config.panelWidth || 340}px; border-radius:\${panelBorderRadius}">
              
              <div class="p-6 relative text-left" style="background:\${headerBgStyle}; border-bottom:\${headerBorderBottom}">
                 <h3 class="text-xl mb-1 \${titleTextClass}" style="\${headerTextStyle}">\${config.title}</h3>
                 <p class="text-sm opacity-90 \${headerTextClass}" style="\${headerTextStyle}">\${config.description}</p>
                 <button id="hub-close" class="absolute top-4 right-4 text-white/80 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors \${closeBtnClass}"><i class="fa-solid fa-xmark"></i></button>
              </div>

              <div class="p-5" style="background:\${bodyContainerBg}; min-height: 200px;">
                
                <div id="hub-step-1" class="grid grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
                    \${channelsHtml}
                </div>

                <div id="hub-step-2" class="hidden flex-col animate-[slideIn_0.3s_ease-out]">
                    <div class="flex items-center gap-3 mb-6">
                        <button onclick="window.hubGoToStep1()" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                            <i class="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <span id="hub-step-2-title" class="text-sm font-bold uppercase tracking-tight text-slate-800 \${bodyTextClass}">CHANNEL</span>
                    </div>
                    
                    <div class="space-y-3">
                        <div id="hub-input-container"></div>
                        \${config.showMessageField !== false ? \`<textarea id="hub-message" rows="3" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="\${config.messagePlaceholder || 'How can we help?'}"></textarea>\` : ''}
                        <button id="hub-send-btn" class="w-full py-4 rounded-xl text-white font-black text-sm uppercase tracking-widest shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                style="background:\${config.backgroundType === 'gradient' ? config.themeGradient : config.themeColor}; margin-top: 1rem; border-radius:\${panelStyle === 'brutalist' ? '0' : '0.75rem'}; border:\${panelStyle === 'brutalist' ? '3px solid black' : 'none'}; color:\${triggerIconColor}">
                            <span>Submit Now</span>
                            <i class="fa-solid fa-paper-plane text-xs"></i>
                        </button>
                    </div>
                </div>

                <div id="hub-step-3" class="hidden flex-col items-center justify-center text-center py-4 animate-[zoomIn_0.3s_ease-out]">
                    <div class="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-4xl mb-6 border border-emerald-100">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h4 class="font-black text-xl text-slate-900 mb-2">Message Sent!</h4>
                    <p class="text-sm text-slate-500 max-w-[200px] leading-relaxed mx-auto">Our team has been notified. We'll be in touch very soon.</p>
                    <button onclick="window.hubGoToStep1()" class="mt-8 px-6 py-2.5 rounded-full border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Send Another</button>
                </div>

              </div>
            </div>
          </div>\`;
          
        // --- LOGIC ---
        var trigger = document.getElementById('hub-trigger');
        var panel = document.getElementById('hub-panel');
        var closeBtn = document.getElementById('hub-close');
        
        var step1 = document.getElementById('hub-step-1');
        var step2 = document.getElementById('hub-step-2');
        var step3 = document.getElementById('hub-step-3');
        var inputContainer = document.getElementById('hub-input-container');
        
        var titleLabel = document.getElementById('hub-step-2-title');
        var sendBtn = document.getElementById('hub-send-btn');
        var currentChannel = '';

        window.hubGoToStep1 = function() {
            step1.classList.remove('hidden'); step1.style.display = 'grid';
            step2.classList.add('hidden'); step2.style.display = 'none';
            step3.classList.add('hidden'); step3.style.display = 'none';
            document.getElementById('hub-message').value = '';
        };

        window.hubHandleInput = function(el, type) {
            var val = el.value;
            if(type === 'gmail' || type === 'proton') {
                el.value = val.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
            } else if(type === 'whatsapp') {
                el.value = val.replace(/\\D/g, '');
            } else if (type === 'telegram') {
                 el.value = val.replace(/@/g, '');
            }
        };

        window.hubGoToStep2 = function(channel) {
            currentChannel = channel;
            step1.classList.add('hidden'); step1.style.display = 'none';
            step2.classList.remove('hidden'); step2.style.display = 'flex';
            
            titleLabel.innerText = channel.toUpperCase();
            
            var prefix = '';
            var suffix = '';
            var placeholder = 'Contact info';
            
            if(channel === 'gmail') { suffix = '@gmail.com'; placeholder = 'username'; }
            else if(channel === 'proton') { suffix = '@proton.me'; placeholder = 'username'; }
            else if(channel === 'telegram') { prefix = '@'; placeholder = 'username'; }
            else if(channel === 'whatsapp') { prefix = '+'; placeholder = '7900...'; }

            inputContainer.innerHTML = \`
                <div class="flex items-center w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500 transition-all"
                     style="border-radius:\${panelStyle === 'brutalist' ? '0' : '0.75rem'}; border:\${panelStyle === 'brutalist' ? '2px solid black' : ''}">
                    \${prefix ? \`<span class="text-slate-400 font-bold mr-1 select-none">\${prefix}</span>\` : ''}
                    <input type="text" id="hub-contact" oninput="window.hubHandleInput(this, '\${channel}')" class="bg-transparent outline-none text-sm font-medium text-slate-700 flex-1 w-full" placeholder="\${placeholder}">
                    \${suffix ? \`<span id="hub-suffix" class="text-slate-400 font-semibold select-none ml-1">\${suffix}</span>\` : ''}
                </div>
            \`;
            
            setTimeout(() => document.getElementById('hub-contact').focus(), 100);
        };

        var toggle = function() { 
            panel.classList.toggle('hidden'); 
            if(panel.classList.contains('hidden')) { setTimeout(window.hubGoToStep1, 300); }
        };
        if(trigger) trigger.onclick = toggle;
        if(closeBtn) closeBtn.onclick = toggle;

        if(sendBtn) {
            sendBtn.onclick = async function() {
                var contactInput = document.getElementById('hub-contact');
                var rawValue = contactInput.value;
                var suffixEl = document.getElementById('hub-suffix');
                
                var prefix = (currentChannel === 'telegram') ? '@' : (currentChannel === 'whatsapp' ? '+' : '');
                var suffix = suffixEl ? suffixEl.innerText : '';
                
                var fullContact = prefix + rawValue + suffix;
                var messageEl = document.getElementById('hub-message');
                var message = messageEl ? messageEl.value : '';
                var showMessageField = config.showMessageField !== false;

                if(!rawValue) {
                    alert('Please enter your contact info');
                    return;
                }
                
                if(showMessageField && !message.trim()) {
                    alert('Please enter a message');
                    return;
                }

                var originalContent = sendBtn.innerHTML;
                sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                sendBtn.disabled = true;

                try {
                    var messageSection = (showMessageField && message) ? ('\\n💬 <b>Message:</b> ' + message) : '';
                    var text = \`🔥 <b>New Lead from Website</b>\\n\\n📣 <b>Channel:</b> \${currentChannel.toUpperCase()}\\n👤 <b>Contact:</b> \${fullContact}\${messageSection}\`;
                    
                    var response = await fetch("https://api.telegram.org/bot" + config.botToken + "/sendMessage", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: config.chatId,
                            text: text,
                            parse_mode: 'HTML'
                        })
                    });

                    if(response.ok) {
                        step2.classList.add('hidden'); step2.style.display = 'none';
                        step3.classList.remove('hidden'); step3.style.display = 'flex';
                    } else {
                        throw new Error('Telegram API Error');
                    }
                } catch (e) {
                    alert('Error sending message: ' + e.message);
                } finally {
                    sendBtn.innerHTML = originalContent;
                    sendBtn.disabled = false;
                }
            };
        }
      } catch (err) {
        console.error('Widget Render Error:', err);
      }
    }, ${initDelay});

  } catch (err) {
    console.error('Widget Init Error:', err);
    alert('Widget Error: ' + err.message);
  }
})();
    `.trim();
  };

  const handleDownloadBundle = () => {
    if (!activeWidget) return;
    const jsContent = generateWidgetScript(activeWidget);

    const download = (filename: string, content: string, type: string) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    download('feedback-widget.js', jsContent, 'application/javascript');
  };

  const handleDownloadDemoHtml = () => {
    if (!activeWidget) return;
    const jsContent = generateWidgetScript(activeWidget, true);

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${activeWidget.name} - Demo Page</title>
    <style>
      html, body { height: 100%; width: 100%; margin: 0; padding: 0; }
      body { font-family: sans-serif; background-color: #f1f5f9; position: relative; }
      .mock-page {
        height: 100%; display: flex; align-items: center; justify-content: center;
        color: #cbd5e1; font-size: 2rem; font-weight: bold; text-transform: uppercase;
        border: 10px solid #e2e8f0; box-sizing: border-box; z-index: 0; position: relative;
      }
    </style>
</head>
<body>
    <div class="mock-page">Ваш Сайт</div>
    <script>${jsContent}</script>
</body>
</html>
    `.trim();

    const download = (filename: string, content: string, type: string) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    download('index.html', htmlContent, 'text/html');
  };

  const embedCode = activeWidget ? `<script>\n${generateWidgetScript(activeWidget)}\n</script>` : '';

  const panelStylePresets: { id: WidgetPanelStyle; label: string; icon: string }[] = [
    { id: 'classic', label: 'Classic', icon: 'fa-solid fa-layer-group' },
    { id: 'monochrome', label: 'Monochrome', icon: 'fa-solid fa-palette' },
    { id: 'glass', label: 'Glass', icon: 'fa-solid fa-wine-glass-empty' },
    { id: 'dark', label: 'Dark', icon: 'fa-solid fa-moon' },
    { id: 'brutalist', label: 'Brutalist', icon: 'fa-solid fa-bolt' },
    { id: 'ocean', label: 'Ocean Deep', icon: 'fa-solid fa-water' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative min-h-[calc(100vh-80px)]">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'widget')} />
      <input type="file" ref={channelFileRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'channel')} />
      <input type="file" ref={projectImportRef} className="hidden" accept=".json" onChange={handleImportProject} />

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm sticky top-24">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Your Hubs</h2>
              <button onClick={createNewWidget} className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 hover:scale-105 transition-all shadow-lg">
                <i className="fa-solid fa-plus text-xs"></i>
              </button>
            </div>
            <div className="space-y-2">
              {widgets.map(w => (
                <div key={w.id} className="group relative">
                  <button onClick={() => setActiveWidget(w)} className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3 ${activeWidget?.id === w.id ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${activeWidget?.id === w.id ? 'bg-indigo-400' : 'bg-slate-300'}`}></div>
                    <span className="font-bold truncate text-xs">{w.name}</span>
                  </button>
                  {widgets.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); deleteWidget(w.id); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-trash text-[10px]"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 pt-8 border-t border-slate-100">
              <h2 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-4">Project Management</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => projectImportRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 hover:bg-slate-100 transition-all gap-2"
                >
                  <i className="fa-solid fa-file-import text-xs"></i>
                  <span className="text-[10px] font-bold uppercase">Import</span>
                </button>
                <button
                  onClick={handleExportProject}
                  disabled={!activeWidget}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 hover:bg-slate-100 transition-all gap-2 disabled:opacity-50"
                >
                  <i className="fa-solid fa-file-export text-xs"></i>
                  <span className="text-[10px] font-bold uppercase">Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {activeWidget ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-2 shadow-sm flex items-center justify-between gap-4">
                <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
                  {['editor', 'security', 'embed'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {tab === 'embed' ? 'Deploy' : tab}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'editor' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Identity & Copy</label>
                      <div className="space-y-4">
                        <input type="text" value={activeWidget.title} onChange={(e) => updateActiveWidget({ title: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm" placeholder="Widget Title" />
                        <div className="relative">
                          <textarea rows={3} value={activeWidget.description} onChange={(e) => updateActiveWidget({ description: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm leading-relaxed" placeholder="Supporting description..." />
                          <button onClick={handleAIAssist} disabled={isLoadingAI} className="absolute right-4 bottom-4 p-2 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center w-10 h-10">
                            <i className={`fa-solid fa-sparkles ${isLoadingAI ? 'animate-pulse' : ''}`}></i>
                          </button>
                        </div>
                        <div className="pt-2">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Description Lines</label>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{activeWidget.descriptionRows || 2}</span>
                          </div>
                          <input type="range" min="1" max="5" step="1" value={activeWidget.descriptionRows || 2} onChange={(e) => updateActiveWidget({ descriptionRows: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                      </div>
                    </div>

                    {/* Message Field Settings */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Message Field</label>
                        <button
                          onClick={() => updateActiveWidget({ showMessageField: !activeWidget.showMessageField })}
                          className={`w-12 h-7 rounded-full transition-all relative ${activeWidget.showMessageField !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}
                        >
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${activeWidget.showMessageField !== false ? 'right-1' : 'left-1'}`}></div>
                        </button>
                      </div>

                      {activeWidget.showMessageField !== false && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Placeholder Text</label>
                            <input
                              type="text"
                              value={activeWidget.messagePlaceholder || 'How can we help?'}
                              onChange={(e) => updateActiveWidget({ messagePlaceholder: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                              placeholder="Enter placeholder text..."
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            <i className="fa-solid fa-info-circle mr-1"></i>
                            When enabled, users can write a message along with their contact info.
                          </p>
                        </div>
                      )}

                      {activeWidget.showMessageField === false && (
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          <i className="fa-solid fa-eye-slash mr-1"></i>
                          Message field is hidden. Users will only provide contact info.
                        </p>
                      )}
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Panel Preset</label>
                      <div className="grid grid-cols-2 gap-3">
                        {panelStylePresets.map(style => (
                          <button key={style.id} onClick={() => updateActiveWidget({ panelStyle: style.id })} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${activeWidget.panelStyle === style.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}>
                            <i className={`${style.icon} text-sm`}></i>
                            <span className="text-[10px] font-bold uppercase tracking-wider">{style.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 text-center">Style Fine-Tuning</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Header Background</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={activeWidget.headerBgOverride || '#4f46e5'} onChange={(e) => updateActiveWidget({ headerBgOverride: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                          <button onClick={() => updateActiveWidget({ headerBgOverride: undefined })} className="text-[9px] text-slate-400 hover:text-slate-900 underline">Reset</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Header Text</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={activeWidget.headerTextOverride || '#ffffff'} onChange={(e) => updateActiveWidget({ headerTextOverride: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                          <button onClick={() => updateActiveWidget({ headerTextOverride: undefined })} className="text-[9px] text-slate-400 hover:text-slate-900 underline">Reset</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Panel Body Background</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={activeWidget.bodyBgOverride || '#ffffff'} onChange={(e) => updateActiveWidget({ bodyBgOverride: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                          <button onClick={() => updateActiveWidget({ bodyBgOverride: undefined })} className="text-[9px] text-slate-400 hover:text-slate-900 underline">Reset</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Card Background</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={activeWidget.cardBgOverride || '#f8fafc'} onChange={(e) => updateActiveWidget({ cardBgOverride: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                          <button onClick={() => updateActiveWidget({ cardBgOverride: undefined })} className="text-[9px] text-slate-400 hover:text-slate-900 underline">Reset</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Card Text</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={activeWidget.cardTextOverride || '#64748b'} onChange={(e) => updateActiveWidget({ cardTextOverride: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                          <button onClick={() => updateActiveWidget({ cardTextOverride: undefined })} className="text-[9px] text-slate-400 hover:text-slate-900 underline">Reset</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 text-center">Layout & Sizing</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-8">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trigger Size</label>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{activeWidget.widgetSize}px</span>
                          </div>
                          <input type="range" min="40" max="100" step="1" value={activeWidget.widgetSize} onChange={(e) => updateActiveWidget({ widgetSize: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Panel Width</label>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{activeWidget.panelWidth || 340}px</span>
                          </div>
                          <input type="range" min="280" max="480" step="10" value={activeWidget.panelWidth || 340} onChange={(e) => updateActiveWidget({ panelWidth: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Border Radius</label>
                            <span className="text-[10px] font-mono text-indigo-600 font-bold">{activeWidget.widgetBorderRadius}px</span>
                          </div>
                          <input type="range" min="0" max="40" step="1" value={activeWidget.widgetBorderRadius} onChange={(e) => updateActiveWidget({ widgetBorderRadius: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center justify-center p-8">
                        <div className="mb-4 flex items-center justify-center shadow-2xl overflow-hidden relative" style={{ width: `${(activeWidget.widgetSize || 64) * 0.8}px`, height: `${(activeWidget.widgetSize || 64) * 0.8}px`, background: activeWidget.backgroundType === 'gradient' ? activeWidget.themeGradient : activeWidget.themeColor, borderRadius: `${activeWidget.widgetBorderRadius}px` }}>
                          {activeWidget.widgetIconMode === 'custom' && activeWidget.customWidgetIconUrl ? (
                            <img src={activeWidget.customWidgetIconUrl} className="w-full h-full object-cover" alt="Custom" />
                          ) : (
                            <i className="fa-solid fa-comments text-white" style={{ fontSize: `${(activeWidget.widgetSize || 64) * 0.3}px` }}></i>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => updateActiveWidget({ widgetIconMode: 'default' })} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${activeWidget.widgetIconMode === 'default' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>Default</button>
                          <button onClick={() => fileInputRef.current?.click()} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${activeWidget.widgetIconMode === 'custom' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400'}`}>Upload Icon</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 text-center">Style & Color</label>
                    <div className="space-y-8">
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-full max-w-sm mx-auto mb-6">
                        <button onClick={() => updateActiveWidget({ backgroundType: 'solid' })} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeWidget.backgroundType === 'solid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Solid</button>
                        <button onClick={() => updateActiveWidget({ backgroundType: 'gradient' })} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeWidget.backgroundType === 'gradient' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Gradient</button>
                      </div>
                      {activeWidget.backgroundType === 'solid' ? (
                        <div className="flex flex-wrap gap-3 justify-center">
                          {PRESET_COLORS.map(color => (
                            <button key={color} onClick={() => updateActiveWidget({ themeColor: color })} className={`w-10 h-10 rounded-full border-4 transition-all hover:scale-110 ${activeWidget.themeColor === color ? 'border-slate-100 ring-2 ring-indigo-500' : 'border-white shadow-sm'}`} style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                          {PRESET_GRADIENTS.map(gradient => (
                            <button key={gradient} onClick={() => updateActiveWidget({ themeGradient: gradient })} className={`h-12 rounded-xl transition-all hover:scale-105 border-4 ${activeWidget.themeGradient === gradient ? 'border-slate-100 ring-2 ring-indigo-500' : 'border-white shadow-sm'}`} style={{ background: gradient }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 text-center">Connected Channels</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeWidget.channels.map(channel => (
                        <div key={channel.type} className={`p-6 rounded-3xl border transition-all ${channel.enabled ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 ${channel.enabled ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-slate-200 text-slate-400'}`}>
                              {channel.iconMode === 'custom' && channel.customIconUrl ? (
                                <img src={channel.customIconUrl} className="w-full h-full object-cover" alt={channel.label} />
                              ) : (
                                <i className={`${getChannelIcon(channel.type)} text-xl`}></i>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{channel.label}</span>
                                <button onClick={() => toggleChannel(channel.type)} className={`w-10 h-6 rounded-full transition-all relative ${channel.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${channel.enabled ? 'right-1' : 'left-1'}`}></div>
                                </button>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => updateChannel(channel.type, { iconMode: 'default' })} className={`text-[8px] font-black uppercase tracking-tighter ${channel.iconMode !== 'custom' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Default Icon</button>
                                <button onClick={() => { setEditingChannel(channel.type); channelFileRef.current?.click(); }} className={`text-[8px] font-black uppercase tracking-tighter ${channel.iconMode === 'custom' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Upload Custom</button>
                              </div>
                            </div>
                          </div>
                          <input type="text" value={channel.label} onChange={(e) => updateChannel(channel.type, { label: e.target.value })} className="w-full px-4 py-2 bg-white/50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-400 mb-2" placeholder="Display Label" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : activeTab === 'security' ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-12 max-w-2xl mx-auto animate-in fade-in duration-300">
                  <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                      <i className="fa-solid fa-shield-keyhole"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Control</h2>
                    <p className="text-sm text-slate-500 mt-2">Connect your Telegram Bot to receive notifications.</p>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bot API Token</label>
                      <input type="password" value={activeWidget.botToken || ''} onChange={(e) => updateActiveWidget({ botToken: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm" placeholder="Your BotFather Token" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Personal Chat ID</label>
                      <input type="text" value={activeWidget.chatId || ''} onChange={(e) => updateActiveWidget({ chatId: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm" placeholder="123456789" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-16 text-center animate-in fade-in duration-300">
                  <div className="max-w-xl mx-auto">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-8 shadow-sm">
                      <i className="fa-solid fa-code-merge"></i>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Ready to Launch?</h2>
                    <p className="text-slate-500 mb-10 leading-relaxed">Download and deploy your widget using the options below.</p>

                    <div className="mt-12 pt-12 border-t border-slate-100">
                      <h3 className="text-xl font-black text-slate-900 mb-4">Export Bundle</h3>
                      <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                        Download a pre-configured JS bundle that has your settings built-in.
                        Ideal for self-hosting without using script parameters.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={handleDownloadBundle}
                          className="py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-4"
                        >
                          <i className="fa-solid fa-code text-lg"></i>
                          <span>Download JS Bundle</span>
                        </button>
                        <button
                          onClick={handleDownloadDemoHtml}
                          className="py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-4"
                        >
                          <i className="fa-solid fa-file-code text-lg"></i>
                          <span>Export HTML Demo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* REACT PREVIEW WIDGET (ВИДИМЫЙ ВСЕГДА В EDITOR TAB) */}
              {activeTab === 'editor' && <Widget config={activeWidget} isPreview={true} />}
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] border border-slate-200 p-20 text-center shadow-sm max-w-2xl mx-auto">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-slate-100">
                <i className="fa-solid fa-sparkles text-3xl text-slate-200"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">No Active Hubs</h3>
              <button onClick={createNewWidget} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-indigo-700 transition-all active:scale-95">Create Hub</button>
            </div>
          )}
        </div>
      </div >
    </div >
  );
};

export default AdminPanel;