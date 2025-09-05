// components/builder/Step3PromptEditor.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Plus, X } from 'lucide-react';

type Section = {
  id: string;
  title: string;
  content: string;
};

type Props = {
  onNext: (sections: Section[]) => void;
  onBack: () => void;
};

export default function Step3PromptEditor({ onNext, onBack }: Props) {
  const [sections, setSections] = useState<Section[]>([
    {
      id: 'greeting',
      title: 'Greeting',
      content: 'Hi! Welcome 👋 How can I help you today?',
    },
    {
      id: 'info',
      title: 'Information AI should capture',
      content: '- Customer name\n- Email / phone number\n- What service/product they want',
    },
    {
      id: 'faq',
      title: 'Company FAQ',
      content: 'Q: What are your opening hours?\nA: Mon–Fri, 9am–6pm.',
    },
  ]);

  const [valid, setValid] = useState(false);

  useEffect(() => {
    setValid(sections.every((s) => s.content.trim() !== ''));
  }, [sections]);

  function updateSection(id: string, value: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, content: value } : s))
    );
  }

  function addSection() {
    const id = Math.random().toString(36).slice(2);
    setSections([...sections, { id, title: 'New Section', content: '' }]);
  }

  function removeSection(id: string) {
    setSections(sections.filter((s) => s.id !== id));
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0c10]">
      <div className="w-full max-w-3xl bg-[#0d0f11] border border-[#00ffc220] rounded-2xl shadow-[0_0_25px_rgba(0,255,194,0.15)] p-8 space-y-6">
        <h2 className="text-2xl font-bold text-white text-center">Step 3: Personality & Knowledge</h2>
        <p className="text-gray-400 text-center mb-6">
          Define what your AI knows and how it should respond
        </p>

        <div className="space-y-6">
          {sections.map((s) => (
            <div
              key={s.id}
              className="bg-[#0b0c10] border border-[#00ffc2] rounded-xl p-4 shadow-[0_0_10px_rgba(0,255,194,0.1)]"
            >
              <div className="flex justify-between items-center mb-2">
                <input
                  className="bg-transparent text-white text-lg font-semibold focus:outline-none"
                  value={s.title}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((sec) =>
                        sec.id === s.id ? { ...sec, title: e.target.value } : sec
                      )
                    )
                  }
                />
                {sections.length > 1 && (
                  <button
                    onClick={() => removeSection(s.id)}
                    className="text-gray-400 hover:text-red-400 transition"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <textarea
                className="w-full bg-transparent text-gray-200 border border-[#00ffc220] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#00ffc2] min-h-[120px]"
                value={s.content}
                onChange={(e) => updateSection(s.id, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={addSection}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00ffc2] text-[#00ffc2] hover:bg-[#00ffc210] transition"
          >
            <Plus size={16} /> Add Section
          </button>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b0c10] border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            disabled={!valid}
            onClick={() => onNext(sections)}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition ${
              valid
                ? 'bg-[#00ffc2] text-black hover:bg-[#00e6b0]'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Next <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
