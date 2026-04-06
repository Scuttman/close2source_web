'use client';

import { useState, useEffect } from 'react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface Props {
  url: string;
  title: string;
  name: string;
}

export default function NewsletterShareButtons({ url, title, name }: Props) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(!!navigator.share);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const enc = encodeURIComponent;
  const shareText = `Read ${name}'s ministry newsletter update`;

  const openFacebookShare = () => {
    const fbAppId = '1598845148014953';
    const shareUrl =
      `https://www.facebook.com/dialog/share?app_id=${fbAppId}` +
      `&display=popup&href=${enc(url)}&redirect_uri=${enc(url)}`;
    window.open(shareUrl, 'fb-share', 'width=600,height=500,resizable=yes');
  };

  return (
    <div className="space-y-5">
      {/* Copy link row */}
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
        <p className="flex-1 text-sm font-mono text-gray-500 truncate">{url}</p>
        <button
          onClick={copy}
          className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${copied ? 'bg-green-500 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white'}`}
        >
          {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Facebook — full Share Dialog (feed + groups + pages) */}
      <button
        onClick={openFacebookShare}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold rounded-xl text-sm transition shadow-sm"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        Share on Facebook
      </button>
      <p className="text-xs text-center text-gray-400 -mt-2">Choose your feed, a group, or a page inside Facebook</p>

      {/* Social platform buttons */}
      <div className="grid grid-cols-3 gap-3">

        {/* WhatsApp */}
        <a
          href={`https://wa.me/?text=${enc(shareText + ': ' + url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#20c05c] text-white font-semibold rounded-xl text-sm transition shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
          </svg>
          WhatsApp
        </a>

        {/* Twitter / X */}
        <a
          href={`https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-gray-800 text-white font-semibold rounded-xl text-sm transition shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Twitter / X
        </a>

        {/* Save as PDF */}
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-900 text-white font-semibold rounded-xl text-sm transition shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
          </svg>
          Save PDF
        </button>
      </div>

      {/* Native share — mobile only, shown when available */}
      {canNativeShare && (
        <button
          onClick={() => navigator.share?.({ title, url, text: shareText })}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-main hover:bg-brand-dark text-white font-semibold rounded-xl text-sm transition shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
          Share via Device…
        </button>
      )}

      <p className="text-xs text-gray-400 text-center pt-1">
        📸 For Instagram — screenshot the card above and post it as an image.
      </p>
    </div>
  );
}
