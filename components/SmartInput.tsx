
import { FC, ChangeEvent } from 'react';
import { ChannelType } from '../config.ts';

interface SmartInputProps {
  type: ChannelType;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const SmartInput: FC<SmartInputProps> = ({ type, value, onChange, placeholder }) => {
  const isEmail = type === ChannelType.GMAIL || type === ChannelType.PROTON;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let newVal = e.target.value;

    if (type === ChannelType.TELEGRAM) {
      // Force @ at start and prevent removal
      if (!newVal.startsWith('@')) {
        newVal = '@' + newVal.replace(/^@+/, '');
      }
    } else if (isEmail) {
      // Prevent entering domain
      newVal = newVal.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
    } else if (type === ChannelType.WHATSAPP) {
      // Only numbers
      newVal = newVal.replace(/\D/g, '');
    }

    onChange(newVal);
  };

  const suffix = type === ChannelType.GMAIL ? '@gmail.com' : type === ChannelType.PROTON ? '@proton.me' : null;

  return (
    <div className="relative flex items-center w-full group">
      <div className={`flex items-center w-full bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all overflow-hidden ${isEmail ? 'px-4' : ''}`}>

        {type === ChannelType.WHATSAPP && (
          <span className="pl-4 text-slate-400 font-bold pointer-events-none">+</span>
        )}

        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`
            bg-transparent py-3 outline-none text-slate-700 font-medium w-full
            ${type === ChannelType.TELEGRAM || type === ChannelType.WHATSAPP ? 'pl-4' : ''}
            ${isEmail ? 'flex-shrink w-auto min-w-[20px]' : 'flex-1'}
          `}
          style={isEmail ? { fieldSizing: 'content' } as any : {}}
        />

        {suffix && (
          <span className="text-slate-400 font-semibold whitespace-nowrap pointer-events-none ml-0.5">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

export default SmartInput;
