// src/app/page.tsx
// NO CHANGES NEEDED in this file. Provided for completeness.

'use client';

import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Type Definitions ---
interface TrestlePhoneOwnerPerson { type: "Person"; name: string | null; /* ... */ }
interface TrestlePhoneOwnerBusiness { type: "Business"; name: string | null; industry?: string | null; /* ... */ }
interface TrestleAddress { city?: string; state?: string; [key: string]: any; }
interface TrestleCallerIdResponse {
    id: string | null; phone_number: string | null; is_valid: boolean | null;
    line_type: string | null; carrier: string | null; is_prepaid: boolean | null;
    is_commercial: boolean | null; belongs_to: TrestlePhoneOwnerPerson | TrestlePhoneOwnerBusiness | null;
    current_addresses: TrestleAddress[] | null; emails: string | string[] | null;
    error?: { message?: string }; warnings?: string[];
}
interface KeyPersonnel {
    name: string;
    title: string;
    linkedInUrl: string | null;
    profileSummary: string | null;
}
interface SalesInsightReport {
    status: 'success' | 'no_business_found' | 'error' | 'not_attempted';
    companyName: string | null; website: string | null; industry: string | null; location: string | null;
    companySize: string | null;
    keyPersonnel: KeyPersonnel[] | null;
    companyOverview: string | null; productsServices: string | null; targetAudience: string | null;
    recentNewsTrigger: string | null; potentialPainPoints: string[] | null; techStackHints: string[] | null;
    conversationStarters: string[] | null; aiConfidenceScore: 'High' | 'Medium' | 'Low' | null;
    researchTimestamp: string | null; researchSources?: string[]; error?: string; message?: string;
}
interface CombinedResult {
    trestleData: TrestleCallerIdResponse | null;
    salesInsightReport: SalesInsightReport;
}
interface ApiErrorResponse {
    error: string; details?: any; trestleStatus?: number;
    perplexityError?: boolean;
}

// --- Link Preview Card Component (Placeholder/Simulated) ---
interface LinkPreviewProps { url: string; }
const LinkPreviewCard: React.FC<LinkPreviewProps> = ({ url }) => {
    const [metadata, setMetadata] = useState<{ title: string | null; favicon: string | null }>({ title: null, favicon: null });
    const [error, setError] = useState<string | null>(null);

    useState(() => {
        try {
            if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
                throw new Error("Invalid URL scheme");
            }
            const urlObject = new URL(url);
            const hostname = urlObject.hostname;
            let derivedTitle = hostname.replace(/^www\./, '');
            const pathParts = urlObject.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0 && pathParts[pathParts.length - 1].length > 3) {
                 derivedTitle = pathParts[pathParts.length - 1].replace(/[-_]/g, ' ');
                 derivedTitle = derivedTitle.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
            } else {
               derivedTitle = derivedTitle.split('.')[0];
               derivedTitle = derivedTitle.charAt(0).toUpperCase() + derivedTitle.slice(1);
            }

            const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
            setMetadata({ title: derivedTitle || hostname, favicon: faviconUrl });
        } catch (e) {
            console.error("Error parsing URL for preview:", url, e);
            setError("Invalid URL format");
            setMetadata({ title: url, favicon: null });
        }
    });

    if (error) {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className="block p-2 border border-red-300 dark:border-red-600/50 rounded-md bg-red-50 dark:bg-red-900/30 text-xs text-red-600 dark:text-red-400 hover:underline break-all">
                {metadata.title || 'Invalid URL'}
            </a>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150"
            title={`Visit ${metadata.title ?? url}`}
        >
            <div className="flex items-center space-x-2">
                {metadata.favicon && (
                    <img
                        src={metadata.favicon}
                        alt=""
                        className="w-4 h-4 flex-shrink-0 rounded-sm object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                )}
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {metadata.title ?? new URL(url).hostname}
                </span>
            </div>
        </a>
    );
};

// --- LinkedIn Icon Component ---
const LinkedInIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.25 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
    </svg>
);


export default function HomePage() {
    const [phoneNumber, setPhoneNumber] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [results, setResults] = useState<CombinedResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        setResults(null);

        if (!phoneNumber.trim()) {
            setError('Please enter a phone number.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneNumber }),
            });

            if (!response.ok) {
                 let errorData: ApiErrorResponse = { error: `API request failed: ${response.statusText || response.status}` };
                 try { errorData = await response.json(); } catch(e) { /* ignore parsing error */ }
                 console.error("API Error Response:", errorData);
                 setError(errorData.details || errorData.error || 'An unknown API error occurred.');
                 setIsLoading(false);
                 return;
            }

            const data: CombinedResult = await response.json();

            if (data.salesInsightReport?.status === 'error') {
                 console.warn("API returned 200 OK, but contains an internal error:", data.salesInsightReport.message);
                 setError(data.salesInsightReport.message || 'An error occurred during insight generation.');
                 setResults(data); // Show Trestle data + error state
            } else if (data.salesInsightReport?.status === 'no_business_found') {
                console.info("No business found for this number.");
                setResults(data); // Show Trestle data + 'no business' state
                 // setError(null); // Clear top-level error for this specific case
            }
             else {
                setResults(data);
                setError(null);
            }

        } catch (err: unknown) {
            console.error("Frontend fetch/processing error:", err);
            if (err instanceof Error) {
                setError(`Network or processing error: ${err.message}`);
            } else {
                setError('An unexpected client-side error occurred.');
            }
            setResults(null);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render Helper Functions ---
    const formatValue = (value: string | null | undefined, placeholder = 'N/A'): string => value ?? placeholder;
    const formatBoolean = (value: boolean | null | undefined): string => (value === null || value === undefined) ? 'N/A' : (value ? 'Yes' : 'No');
    const formatList = (items: string[] | null | undefined, placeholder = 'N/A'): React.ReactNode => {
        if (!items || items.length === 0) return <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>;
        return ( <ul className="list-disc list-inside ml-4 space-y-1"> {items.map((item, index) => <li key={index}>{item}</li>)} </ul> );
    };

    const formatPersonnel = (
        items: KeyPersonnel[] | null | undefined,
        companyName: string | null,
        placeholder = 'N/A'
    ): React.ReactNode => {
        if (!items || items.length === 0) return <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>;

        const generateLinkedInSearchUrl = (name: string, company: string | null): string => {
            const query = encodeURIComponent(`${name}${company ? ` ${company}` : ''}`);
            return `https://www.linkedin.com/search/results/people/?keywords=${query}&origin=GLOBAL_SEARCH_HEADER`;
        };

        return (
            <ul className="space-y-3">
                {items.map((item, index) => {
                    const profileUrl = item.linkedInUrl;
                    const searchUrl = generateLinkedInSearchUrl(item.name, companyName);
                    const linkTarget = profileUrl ?? searchUrl;
                    const linkTitle = profileUrl
                        ? `View ${item.name}'s LinkedIn Profile`
                        : `Search for ${item.name} (${companyName ?? 'Unknown Company'}) on LinkedIn`;

                    return (
                        <li key={index} className="group">
                             <div className="flex items-center space-x-2 mb-1">
                                <a
                                    href={linkTarget}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={linkTitle}
                                    className="flex items-center text-blue-600 dark:text-blue-400 group-hover:underline"
                                >
                                    <LinkedInIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                    <strong className="font-medium">{item.name}</strong>
                                </a>
                                <span className="text-slate-600 dark:text-slate-400 text-xs">- {item.title}</span>
                            </div>
                            {item.profileSummary && (
                                <p className="text-xs text-slate-500 dark:text-slate-400/90 pl-[calc(0.875rem+0.375rem)]">
                                    {item.profileSummary}
                                </p>
                            )}
                        </li>
                    );
                })}
                 <p className="italic text-slate-500 dark:text-slate-500 text-[11px] pt-1.5">
                    (Links open profiles or initiate a LinkedIn search.)
                </p>
            </ul>
        );
    };

    // --- Render Trestle Data ---
    const renderTrestleData = (data: TrestleCallerIdResponse | null) => {
        if (!data) return null;

        return (
            <div className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                 <h4 className="p-3 font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    Raw Trestle Data
                 </h4>
                 <div className="p-4 space-y-1 text-slate-700 dark:text-slate-300">
                     <p><strong>Phone:</strong> {data.phone_number ?? 'N/A'}</p>
                     <p><strong>Valid:</strong> {formatBoolean(data.is_valid)}</p>
                     <p><strong>Commercial:</strong> {formatBoolean(data.is_commercial)}</p>
                     <p><strong>Line Type:</strong> {data.line_type ?? 'N/A'}</p>
                     <p><strong>Carrier:</strong> {data.carrier ?? 'N/A'}</p>
                     {data.belongs_to && <p><strong>Belongs To:</strong> {data.belongs_to.name ?? 'N/A'} ({data.belongs_to.type})</p> }
                     {data.current_addresses?.[0] && <p><strong>Location Hint:</strong> {data.current_addresses[0].city ?? ''}{data.current_addresses[0].city && data.current_addresses[0].state ? ', ' : ''}{data.current_addresses[0].state ?? ''}</p> }
                     {data.error && <p className="text-red-600 dark:text-red-400 mt-1"><strong>Trestle Specific Error:</strong> {data.error.message}</p>}
                     {data.warnings && data.warnings.length > 0 && <p className="text-yellow-600 dark:text-yellow-400 mt-1"><strong>Trestle Warnings:</strong> {data.warnings.join(', ')}</p>}
                 </div>
             </div>
        );
    };

    // --- Render Sales Insight Report ---
    const renderSalesInsightReport = (report: SalesInsightReport | null) => {
         if (!report || report.status === 'not_attempted') return null;

         if (report.status === 'error' || report.status === 'no_business_found') {
             const isError = report.status === 'error';
             const bgColor = isError ? 'bg-red-50 dark:bg-red-900/30' : 'bg-orange-50 dark:bg-orange-900/30';
             const borderColor = isError ? 'border-red-300 dark:border-red-600/50' : 'border-orange-300 dark:border-orange-600/50';
             const textColor = isError ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300';
             const title = isError ? 'Report Generation Failed' : 'No Business Found';
             let message = report.message || (isError ? 'Could not generate sales insights.' : 'No business identified for this number.');

             return (
                 <motion.div
                     key={`report-status-${report.status}`}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     transition={{ duration: 0.3 }}
                     className={`p-4 border ${borderColor} rounded-lg ${bgColor} ${textColor} text-sm shadow`}
                 >
                     <h3 className="font-semibold mb-1">{title}</h3>
                     <p>{message}</p>
                     {isError && report.error && error !== report.message && (
                         <p className="text-xs mt-1 opacity-80">Details: {report.error}</p>
                     )}
                 </motion.div>
             );
         }

         if (report.status === 'success' && report.companyName) {
             return (
                 <motion.div
                    key="report-success"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="p-5 md:p-6 border border-indigo-200 dark:border-indigo-900/50 rounded-lg bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/50 dark:from-slate-800/80 dark:via-slate-800 dark:to-slate-800/80 text-sm shadow-lg"
                 >
                     <h3 className="text-xl font-semibold mb-4 text-indigo-800 dark:text-indigo-300 border-b border-indigo-200 dark:border-indigo-800 pb-2">
                        Sales Insights Report for {report.companyName}
                     </h3>
                     <div className="space-y-5">
                         <Section title="Company Overview">
                             <Field label="Website" value={report.website ? <a href={report.website.startsWith('http') ? report.website : `//${report.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">{report.website}</a> : 'N/A'} />
                             <Field label="Industry" value={report.industry} />
                             <Field label="Location" value={report.location} />
                             <Field label="Company Size" value={report.companySize} />
                             <Field label="Description" value={report.companyOverview} />
                             <Field label="Products/Services" value={report.productsServices} />
                             <Field label="Target Audience" value={report.targetAudience} />
                         </Section>

                         <Section title="Actionable Intelligence">
                             <Field label="Recent News / Trigger" value={report.recentNewsTrigger} />
                             <Field label="Potential Pain Points" value={formatList(report.potentialPainPoints)} />
                             <Field label="Conversation Starters" value={formatList(report.conversationStarters)} />
                         </Section>

                          <Section title="Additional Context">
                             <Field label="Key Personnel" value={formatPersonnel(report.keyPersonnel, report.companyName)} />
                             <Field label="Tech Stack Hints" value={formatList(report.techStackHints)} />
                         </Section>

                          <div className="mt-5 pt-4 border-t border-indigo-200 dark:border-indigo-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                              <p><strong>AI Confidence:</strong> {formatValue(report.aiConfidenceScore, 'Medium')}</p>
                              {report.researchSources && report.researchSources.length > 0 && (
                                 <div>
                                     <p className="font-medium mb-1.5 text-slate-700 dark:text-slate-300"><strong>Sources Used:</strong></p>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                         {report.researchSources.map((url, i) => ( url ? <LinkPreviewCard key={`${url}-${i}`} url={url} /> : null ))}
                                     </div>
                                      <p className="italic text-slate-500 dark:text-slate-500 text-[11px] pt-1.5"> (Link previews are simplified.) </p>
                                 </div>
                              )}
                             <p><strong>Report Generated:</strong> {report.researchTimestamp ? new Date(report.researchTimestamp).toLocaleString() : 'N/A'}</p>
                          </div>
                     </div>
                 </motion.div>
             );
         }
         return null;
    };

    // --- Helper components (Section, Field) ---
    const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
         <div>
            <h4 className="text-lg font-semibold mb-3 text-indigo-700 dark:text-indigo-400 border-b border-indigo-200/80 dark:border-indigo-800/60 pb-1.5"> {title} </h4>
            <div className="space-y-2.5 text-slate-800 dark:text-slate-300">{children}</div>
        </div>
    );
     const Field: React.FC<{ label: string; value: React.ReactNode | string | null | undefined; boldValue?: boolean }> = ({ label, value, boldValue = false }) => (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-2 gap-y-1 items-start">
            <span className="font-medium text-slate-600 dark:text-slate-400 col-span-1 sm:text-right pr-2">{label}:</span>
            <span className={`sm:col-span-2 ${boldValue ? 'font-semibold text-slate-900 dark:text-slate-100' : ''}`}>
                {(value === null || value === undefined || (typeof value === 'string' && value.trim() === ''))
                    ? <span className="text-slate-500 dark:text-slate-500">N/A</span>
                    : value}
            </span>
        </div>
    );

    // --- Framer Motion Variants ---
    const errorVariants = {
        hidden: { opacity: 0, y: -10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
        exit: { opacity: 0, y: -5, transition: { duration: 0.15 } }
    };


    return (
        <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12 lg:p-16 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-200">
            <div className="z-10 w-full max-w-3xl items-center justify-between font-sans bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl dark:border dark:border-slate-700">
                 <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-center text-slate-800 dark:text-slate-100">
                     Business Information Finder
                 </h1>
                <form onSubmit={handleSubmit} className="w-full space-y-5">
                     <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"> Enter Business Phone Number </label>
                        <input type="tel" id="phone" name="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g., 3015551234 or 12405551234" required /* Updated Placeholder */
                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent dark:focus:border-transparent disabled:bg-slate-100 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                            disabled={isLoading} />
                    </div>
                    <button type="submit" disabled={isLoading}
                        className={`w-full inline-flex items-center justify-center py-3 px-4 border border-transparent shadow-sm text-base font-medium rounded-md text-white transition-colors duration-200 ease-in-out ${ isLoading ? 'bg-indigo-400 dark:bg-indigo-700/60 cursor-not-allowed' : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 dark:focus:ring-indigo-400' }`} >
                        {isLoading ? ( <> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg> Researching... </> ) : ( 'Get Sales Insights' )}
                    </button>
                </form>

                <div className="mt-8 w-full">
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                key="error-message"
                                variants={errorVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="mb-6 p-4 border border-red-300 dark:border-red-600/50 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm shadow" role="alert"
                            >
                                <h3 className="font-semibold mb-1">Error</h3>
                                <p>{error}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                         {!isLoading && results?.salesInsightReport && (
                             renderSalesInsightReport(results.salesInsightReport)
                         )}
                    </AnimatePresence>

                     {!isLoading && results?.trestleData && results.salesInsightReport?.status === 'success' && (
                         <motion.div
                            key="trestle-data"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="mt-6"
                         >
                            {renderTrestleData(results.trestleData)}
                         </motion.div>
                     )}


                    {isLoading && (
                         <div className="text-center py-10">
                            <p className="text-indigo-600 dark:text-indigo-400 font-medium text-lg animate-pulse">
                                Gathering data & generating insights...
                            </p>
                         </div>
                    )}
                </div>
            </div>
        </main>
    );
}