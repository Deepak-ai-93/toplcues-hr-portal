/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, CheckCircle, FileText, ScrollText } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { TermsVersion } from '../../types';
import { getTerm } from '../../lib/api';
import { formatKolkataDate } from '../../lib/payrollCalculator';
import { INITIAL_TERMS_V1 } from '../../lib/seedData';

export const StaffTermsPage: React.FC = () => {
  const [terms, setTerms] = useState<TermsVersion>(INITIAL_TERMS_V1);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadTerms() {
      try {
        const loadedTerms = await getTerm('terms-v1.0');
        if (loadedTerms) setTerms(loadedTerms);
      } catch (err) {
        console.warn('Error loading published terms:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTerms();
  }, []);

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Topclues Solutions Employment & Remuneration Policies
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Official statutory rules governing casual leave, emergency permissions, attendance grace, and overtime compensations.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {terms.title}
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">
              Version {terms.versionNumber} · Effective Date: {formatKolkataDate(terms.effectiveDate)}
            </div>
          </div>
          <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 self-start sm:self-center">
            Currently Enforced
          </span>
        </div>

        <div className="prose dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
          {terms.content}
        </div>
      </div>
    </div>
  );
};
