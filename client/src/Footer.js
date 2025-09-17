import React, { useState, useEffect } from 'react';
import './Footer.css';

const API_BASE = '/texon-invoicing-portal/api';

const Footer = () => {
    const [versionInfo, setVersionInfo] = useState({
        version: 'Loading...',
        name: 'Texon Invoicing Portal',
        url: '',
        publishedAt: null,
        cached: false,
        fallback: false,
        error: null
    });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        fetchVersionInfo();
        
        // Set up periodic refresh (every 5 minutes)
        const intervalId = setInterval(fetchVersionInfo, 5 * 60 * 1000);
        
        return () => clearInterval(intervalId);
    }, []);

    const fetchVersionInfo = async () => {
        try {
            const response = await fetch(`${API_BASE}/version`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setVersionInfo({
                        version: data.version || 'Unknown',
                        name: data.name || 'Texon Invoicing Portal',
                        url: data.url || '',
                        publishedAt: data.publishedAt,
                        cached: data.cached || false,
                        fallback: data.fallback || false,
                        error: data.error || null
                    });
                } else {
                    throw new Error(data.error || 'Failed to fetch version');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching version info:', error);
            setVersionInfo(prev => ({
                ...prev,
                version: 'v1.0.0',
                error: error.message,
                fallback: true
            }));
        } finally {
            setLoading(false);
            setLastUpdated(new Date());
        }
    };

    const handleVersionClick = () => {
        if (versionInfo.url) {
            window.open(versionInfo.url, '_blank', 'noopener,noreferrer');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return '';
        }
    };

    const getStatusIcon = () => {
        if (loading) return '⏳';
        if (versionInfo.error && !versionInfo.fallback) return '❌';
        if (versionInfo.fallback) return '📦';
        if (versionInfo.cached) return '💾';
        return '✅';
    };

    const getStatusText = () => {
        if (loading) return 'Loading version...';
        if (versionInfo.error && !versionInfo.fallback) return 'GitHub API unavailable';
        if (versionInfo.fallback) return 'Using package.json version';
        if (versionInfo.cached) return 'Cached from GitHub';
        return 'Live from GitHub';
    };

    const getStatusColor = () => {
        if (loading) return '#6b7280';
        if (versionInfo.error && !versionInfo.fallback) return '#ef4444';
        if (versionInfo.fallback) return '#f59e0b';
        if (versionInfo.cached) return '#3b82f6';
        return '#10b981';
    };

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-left">
                    <div className="version-info" onClick={handleVersionClick}>
                        <span 
                            className="status-icon" 
                            title={getStatusText()}
                            style={{ color: getStatusColor() }}
                        >
                            {getStatusIcon()}
                        </span>
                        <span className="version-text">
                            {versionInfo.version}
                            {versionInfo.publishedAt && (
                                <span className="version-date">
                                    {' '}• Released {formatDate(versionInfo.publishedAt)}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
                
                <div className="footer-center">
                    <span className="footer-title">Texon Invoicing Portal</span>
                    <span className="footer-subtitle">
                        Brightpearl Integration • Invoice Management
                    </span>
                </div>
                
                <div className="footer-right">
                    <div className="footer-meta">
                        {lastUpdated && (
                            <span className="last-updated">
                                Last updated: {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button 
                            className="refresh-version"
                            onClick={() => {
                                setLoading(true);
                                fetchVersionInfo();
                            }}
                            disabled={loading}
                            title="Refresh version information"
                        >
                            🔄
                        </button>
                    </div>
                </div>
            </div>

            {/* Debug info (only show in development or when there's an error) */}
            {(versionInfo.error || process.env.NODE_ENV === 'development') && (
                <div className="footer-debug">
                    <details>
                        <summary>Debug Info</summary>
                        <div className="debug-content">
                            <div><strong>Status:</strong> {getStatusText()}</div>
                            <div><strong>Cached:</strong> {versionInfo.cached ? 'Yes' : 'No'}</div>
                            <div><strong>Fallback:</strong> {versionInfo.fallback ? 'Yes' : 'No'}</div>
                            {versionInfo.error && (
                                <div><strong>Error:</strong> {versionInfo.error}</div>
                            )}
                            {lastUpdated && (
                                <div><strong>Last Check:</strong> {lastUpdated.toLocaleString()}</div>
                            )}
                        </div>
                    </details>
                </div>
            )}
        </footer>
    );
};

export default Footer;