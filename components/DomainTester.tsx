'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { getInitialState, Category, DomainStatus } from '@/lib/domains';

// ============================================================================
//  NEW & UPDATED SUB-COMPONENTS
// ============================================================================

// UPDATED: StatusIndicator now uses the .badges styling
const StatusIndicator = ({ status }: { status: DomainStatus['status'] }) => {
    // Note the color logic: blocked is good (green), reachable is bad (red)
    const statusMap = {
        pending: { text: 'Pending', className: 'light-orange' },
        reachable: { text: 'Reachable', className: 'light-red' },
        blocked: { text: 'Blocked', className: 'light-green' },
    };
    const { text, className } = statusMap[status];

    return <span className={className}>{text}</span>;
};

// NEW: Loading animation component for when tests are running
const LoadingAnimation = () => (
    <div className="lt_wrap _mt-2">
        <h4>Testing Domains...</h4>
        <div className="lt_particles start">
            <div className="p1"></div>
            <div className="p2"></div>
            <div className="p3"></div>
            <div className="p4"></div>
            <div className="p5"></div>
        </div>
    </div>
);

// NEW: Liquid wave component to display the final score
const ScoreDisplay = ({ percentage, blockedCount, totalCount }: { percentage: number, blockedCount: number, totalCount: number }) => {
    let scoreColor = 'var(--red)';
    let scoreTitle = '"POOR"';
    if (percentage >= 80) {
        scoreColor = 'var(--green)';
        scoreTitle = '"EXCELLENT"';
    } else if (percentage >= 50) {
        scoreColor = 'var(--orange)';
        scoreTitle = '"GOOD"';
    }

    const dynamicStyles = {
        '--liquid-percentage': `${100 - percentage}%`,
        '--liquid-color': scoreColor,
        '--liquid-title': scoreTitle,
    } as React.CSSProperties;

    return (
        <div className="lt_wrap _mt-2" style={dynamicStyles}>
            <div className="lt_cwrap">
                <div className="lt_circle">
                    <div className="lt_wave"></div>
                </div>
                <div className="lt_value"></div>
            </div>
            <h3 className="_mt-1">{percentage}% Blocked</h3>
            <p>({blockedCount} out of {totalCount} domains)</p>
        </div>
    );
};

// NEW: Theme toggle button with SVG icons
const ThemeToggle = ({ theme, toggleTheme }: { theme: string; toggleTheme: () => void; }) => (
    <button onClick={toggleTheme} className="btn" title="Toggle Theme" style={{ minWidth: 'auto', padding: '0.5rem' }}>
        {/* Sun Icon */}
        <svg className="light-icon" style={{ display: theme === 'light' ? 'block' : 'none' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        {/* Moon Icon */}
        <svg className="dark-icon" style={{ display: theme === 'dark' ? 'block' : 'none' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>
);


// ============================================================================
//  MAIN DOMAIN TESTER COMPONENT
// ============================================================================

export default function DomainTester() {
    const [domainData, setDomainData] = useState<Category>(getInitialState);
    const [isTesting, setIsTesting] = useState(false);
    const [testedCount, setTestedCount] = useState(0);
    const [theme, setTheme] = useState('light'); // Default to light

    // EFFECT: Detect user's preferred theme on initial load
    useEffect(() => {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }, []);

    // EFFECT: Apply the theme to the document when it changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    const totalDomains = useMemo(() => Object.values(domainData).reduce(
        (acc, services) => acc + Object.values(services).reduce((sAcc, d) => sAcc + d.length, 0), 0
    ), [domainData]);

    const blockedCount = useMemo(() => {
        return Object.values(domainData).flat().flat().reduce((acc, services) =>
            acc + Object.values(services).reduce((serviceAcc, domains) =>
                serviceAcc + domains.filter(d => d.status === 'blocked').length, 0), 0
        );
    }, [domainData]);

    const blockedPercentage = totalDomains > 0 ? Math.round((blockedCount / totalDomains) * 100) : 0;

    const updateDomainStatus = useCallback((category: string, service: string, domainName: string, status: DomainStatus['status']) => {
        setDomainData(prevData => {
            const newData = JSON.parse(JSON.stringify(prevData));
            const domainIndex = newData[category][service].findIndex((d: DomainStatus) => d.name === domainName);
            if (domainIndex !== -1) {
                newData[category][service][domainIndex].status = status;
            }
            return newData;
        });
        setTestedCount(prev => prev + 1);
    }, []);

    const checkDomain = async (domain: string): Promise<DomainStatus['status']> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
            await fetch(`https://${domain}`, { method: 'HEAD', mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
            clearTimeout(timeoutId);
            return 'reachable';
        } catch (error) {
            clearTimeout(timeoutId);
            return 'blocked';
        }
    };

    const handleStartTest = async () => {
        setIsTesting(true);
        setTestedCount(0);
        const allTestPromises = Object.values(domainData).flat().flatMap(services =>
            Object.entries(services).flatMap(([serviceName, domains]) =>
                domains.map(domain => {
                    const categoryName = Object.keys(domainData).find(cat => domainData[cat][serviceName]);
                    if (categoryName) {
                       return checkDomain(domain.name).then(status => {
                           updateDomainStatus(categoryName, serviceName, domain.name, status);
                       });
                    }
                    return Promise.resolve();
                })
            )
        );
        await Promise.all(allTestPromises);
        setIsTesting(false);
    };

    const handleReset = () => {
        setDomainData(getInitialState());
        setTestedCount(0);
        setIsTesting(false);
    };

    const testIsFinished = !isTesting && testedCount === totalDomains && totalDomains > 0;

    return (
        <main className="cnt">
            <div className="_ta-center">
                <h2>DNS Reachability Tester</h2>
                <p>This tool checks if your browser can reach common ad, tracking, and analytics domains.</p>

                <div className="_f-center" style={{ alignItems: 'center' }}>
                    <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                    <button onClick={handleStartTest} disabled={isTesting} className="btn btn-p">
                        {isTesting ? 'Testing...' : 'Start Test'}
                    </button>
                    <button onClick={handleReset} disabled={isTesting} type="reset" className="btn">
                        Reset
                    </button>
                </div>

                {isTesting && <LoadingAnimation />}
                {testIsFinished && <ScoreDisplay percentage={blockedPercentage} blockedCount={blockedCount} totalCount={totalDomains} />}
            </div>

            <div className="grid _mt-1">
                {Object.entries(domainData).map(([categoryName, services]) => (
                    <div key={categoryName} className="card">
                        <h3>{categoryName}</h3>
                        <div className="badges">
                            {Object.entries(services).flatMap(([serviceName, domains]) =>
                                domains.map((domain) => (
                                    <StatusIndicator key={domain.name} status={domain.status} />
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
