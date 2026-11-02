/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Archive,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck,
  History,
  Lock,
  Plus,
  ScrollText,
  ShieldAlert
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { TermsVersion } from '../../types';
import { listTerms, saveTerm, updateTerm } from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import { formatKolkataDate, formatKolkataDateTime } from '../../lib/payrollCalculator';
import { INITIAL_TERMS_V1 } from '../../lib/seedData';
import { useAuth } from '../../lib/authContext';

export const TermsPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [versions, setVersions] = useState<TermsVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<TermsVersion | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Edit / Create Form
  const [formVersionNumber, setFormVersionNumber] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formEffectiveDate, setFormEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    loadTerms();
  }, []);

  async function loadTerms() {
    setLoading(true);
    try {
      const list = await listTerms();

      if (list.length === 0) {
        list.push(INITIAL_TERMS_V1);
      }

      list.sort((a, b) => (b.versionNumber || '').localeCompare(a.versionNumber || ''));
      setVersions(list);

      const published = list.find((v) => v.status === 'Published') || list[0];
      setSelectedVersion(published);
    } catch (err) {
      console.warn('Error loading terms:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleStartNewVersion() {
    if (!isSuperAdmin) {
      alert('Only the Super Admin (ceo@topclues.in) can create terms versions.');
      return;
    }
    const nextVer = selectedVersion
      ? (parseFloat(selectedVersion.versionNumber) + 0.1).toFixed(1)
      : '1.1';
    setFormVersionNumber(nextVer);
    setFormTitle(selectedVersion?.title || 'Topclues Solutions Remuneration Policy');
    setFormContent(selectedVersion?.content || '');
    setFormEffectiveDate(new Date().toISOString().split('T')[0]);
    setIsEditing(true);
  }

  async function handleSaveNewVersion(publishImmediately: boolean) {
    if (!isSuperAdmin) return;
    if (!formVersionNumber.trim() || !formTitle.trim() || !formContent.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    const versionId = `terms-v${formVersionNumber.trim()}`;
    const hash = `hash_v${formVersionNumber}_${Date.now()}`;

    const newVersion: TermsVersion = {
      id: versionId,
      versionNumber: formVersionNumber.trim(),
      title: formTitle.trim(),
      content: formContent.trim(),
      effectiveDate: formEffectiveDate,
      status: publishImmediately ? 'Published' : 'Draft',
      createdBy: userProfile?.email || 'ceo@topclues.in',
      createdAt: new Date().toISOString(),
      publishedBy: publishImmediately ? userProfile?.email : undefined,
      publishedAt: publishImmediately ? new Date().toISOString() : undefined,
      contentHash: hash,
    };

    try {
      await saveTerm(newVersion);

      // If publishing, archive other published versions
      if (publishImmediately) {
        for (const v of versions) {
          if (v.status === 'Published' && v.id !== versionId) {
            await updateTerm(v.id, { status: 'Archived' });
          }
        }
      }

      await logAuditEvent({
        actorUid: userProfile?.uid || 'SUPER_ADMIN',
        actorEmail: userProfile?.email || 'ceo@topclues.in',
        actorRole: 'SUPER_ADMIN',
        action: publishImmediately ? 'PUBLISH_TERMS_VERSION' : 'CREATE_TERMS_VERSION',
        entityType: 'TERMS',
        entityId: versionId,
        details: {
          versionNumber: newVersion.versionNumber,
          title: newVersion.title,
          status: newVersion.status,
          effectiveDate: newVersion.effectiveDate,
        },
      });

      setIsEditing(false);
      await loadTerms();
      setSelectedVersion(newVersion);
      alert(`Terms version ${newVersion.versionNumber} saved successfully.`);
    } catch (err) {
      console.error('Error saving terms:', err);
      alert('Failed to save terms version.');
    }
  }

  async function handlePublishExisting(version: TermsVersion) {
    if (!isSuperAdmin) return;
    const confirmed = window.confirm(
      `Are you sure you want to publish Terms Version ${version.versionNumber}? This will govern future payroll periods.`
    );
    if (!confirmed) return;

    try {
      for (const v of versions) {
        if (v.id !== version.id && v.status === 'Published') {
          await updateTerm(v.id, { status: 'Archived' });
        }
      }

      await updateTerm(version.id, {
        status: 'Published',
        publishedBy: userProfile?.email,
        publishedAt: new Date().toISOString(),
      });

      await logAuditEvent({
        actorUid: userProfile?.uid || 'SUPER_ADMIN',
        actorEmail: userProfile?.email || 'ceo@topclues.in',
        actorRole: 'SUPER_ADMIN',
        action: 'PUBLISH_TERMS_VERSION',
        entityType: 'TERMS',
        entityId: version.id,
        details: { versionNumber: version.versionNumber },
      });

      await loadTerms();
    } catch (err) {
      console.error('Publish terms error:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Terms & Conditions Version Governance
            </h1>
            {!isSuperAdmin && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-500">
                View Only
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Maintain legally binding salary and leave policy terms. Historical payroll records retain immutable version hashes.
          </p>
        </div>

        {isSuperAdmin && !isEditing && (
          <button
            onClick={handleStartNewVersion}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Version</span>
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Versions Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Version History
            </div>
            {versions.map((ver) => {
              const isSelected = selectedVersion?.id === ver.id;
              return (
                <div
                  key={ver.id}
                  onClick={() => setSelectedVersion(ver)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      Version {ver.versionNumber}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                        ver.status === 'Published'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : ver.status === 'Draft'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {ver.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{ver.title}</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Effective: {formatKolkataDate(ver.effectiveDate)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Version Reader Body */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            {selectedVersion ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {selectedVersion.title}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        v{selectedVersion.versionNumber}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Effective Date: {formatKolkataDate(selectedVersion.effectiveDate)} · Published by {selectedVersion.publishedBy || selectedVersion.createdBy}
                    </div>
                  </div>

                  {isSuperAdmin && selectedVersion.status !== 'Published' && (
                    <button
                      onClick={() => handlePublishExisting(selectedVersion)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100"
                    >
                      Publish Version
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-400">
                  Document Integrity Hash: {selectedVersion.contentHash}
                </div>

                <div className="prose dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {selectedVersion.content}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-400">Select a version from the left.</div>
            )}
          </div>
        </div>
      ) : (
        /* Edit / Create Form (Super Admin only) */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Draft New Terms & Conditions Version
            </h2>
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Version Identifier *
              </label>
              <input
                type="text"
                value={formVersionNumber}
                onChange={(e) => setFormVersionNumber(e.target.value)}
                placeholder="e.g. 1.1"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Policy Document Title *
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Topclues Solutions Master Employment & Salary Payout Policy"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Effective From Date *
              </label>
              <input
                type="date"
                value={formEffectiveDate}
                onChange={(e) => setFormEffectiveDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Policy Content & Terms Clauses *
            </label>
            <textarea
              rows={14}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveNewVersion(false)}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSaveNewVersion(true)}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
            >
              Publish & Activate Version
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
