const axios = require('axios');

/**
 * GitHub Service for fetching release information
 * Provides cached access to GitHub repository release data
 */
class GitHubService {
    constructor() {
        // Parse repository information from package.json or environment
        this.repoOwner = 'rynoceris';
        this.repoName = 'texon-invoicing-portal';
        
        // Cache settings
        this.cache = {
            data: null,
            timestamp: null,
            ttl: 5 * 60 * 1000 // 5 minutes cache TTL
        };
        
        console.log('✅ GitHub Service initialized for', `${this.repoOwner}/${this.repoName}`);
    }

    /**
     * Check if cache is still valid
     */
    isCacheValid() {
        if (!this.cache.data || !this.cache.timestamp) {
            return false;
        }
        
        const now = Date.now();
        return (now - this.cache.timestamp) < this.cache.ttl;
    }

    /**
     * Fetch the latest release from GitHub API
     */
    async fetchLatestRelease() {
        try {
            console.log('🔍 Fetching latest release from GitHub API...');
            
            const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
            
            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Texon-Invoicing-Portal/1.0'
                },
                timeout: 10000 // 10 second timeout
            });

            if (response.status === 200) {
                const release = response.data;
                
                const releaseInfo = {
                    version: release.tag_name,
                    name: release.name,
                    publishedAt: release.published_at,
                    htmlUrl: release.html_url,
                    body: release.body,
                    prerelease: release.prerelease,
                    draft: release.draft,
                    fetchedAt: new Date().toISOString()
                };

                // Update cache
                this.cache.data = releaseInfo;
                this.cache.timestamp = Date.now();

                console.log('✅ Latest release fetched:', releaseInfo.version);
                return {
                    success: true,
                    data: releaseInfo
                };
            } else {
                throw new Error(`GitHub API returned status ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Error fetching latest release from GitHub:', error.message);
            
            // Return cached data if available, otherwise fallback
            if (this.cache.data) {
                console.log('🔄 Using cached release data due to API error');
                return {
                    success: true,
                    data: this.cache.data,
                    cached: true,
                    error: error.message
                };
            }

            // Final fallback to package.json version
            return this.getFallbackVersion(error.message);
        }
    }

    /**
     * Get version information with caching
     */
    async getLatestVersion() {
        // Return cached data if still valid
        if (this.isCacheValid()) {
            console.log('📋 Using cached release data');
            return {
                success: true,
                data: this.cache.data,
                cached: true
            };
        }

        // Fetch fresh data from GitHub
        return await this.fetchLatestRelease();
    }

    /**
     * Fallback to package.json version when GitHub API is unavailable
     */
    getFallbackVersion(errorMessage = 'GitHub API unavailable') {
        try {
            const packageJson = require('./package.json');
            
            const fallbackInfo = {
                version: `v${packageJson.version}`,
                name: `${packageJson.name} v${packageJson.version}`,
                publishedAt: new Date().toISOString(),
                htmlUrl: `https://github.com/${this.repoOwner}/${this.repoName}`,
                body: 'Version information from package.json (GitHub API unavailable)',
                prerelease: false,
                draft: false,
                fetchedAt: new Date().toISOString(),
                fallback: true
            };

            console.log('📦 Using package.json fallback version:', fallbackInfo.version);
            
            return {
                success: true,
                data: fallbackInfo,
                fallback: true,
                error: errorMessage
            };

        } catch (fallbackError) {
            console.error('❌ Error reading package.json for fallback:', fallbackError.message);
            
            return {
                success: false,
                error: `GitHub API error: ${errorMessage}. Fallback error: ${fallbackError.message}`,
                data: {
                    version: 'v1.0.0',
                    name: 'Texon Invoicing Portal',
                    publishedAt: new Date().toISOString(),
                    htmlUrl: `https://github.com/${this.repoOwner}/${this.repoName}`,
                    body: 'Version information unavailable',
                    prerelease: false,
                    draft: false,
                    fetchedAt: new Date().toISOString(),
                    fallback: true,
                    error: true
                }
            };
        }
    }

    /**
     * Get version information for display in footer
     */
    async getVersionInfo() {
        const result = await this.getLatestVersion();
        
        if (result.success) {
            const release = result.data;
            
            return {
                success: true,
                version: release.version,
                name: release.name,
                url: release.htmlUrl,
                publishedAt: release.publishedAt,
                cached: result.cached || false,
                fallback: result.fallback || false,
                error: result.error || null
            };
        }

        return {
            success: false,
            error: result.error,
            version: 'Unknown',
            name: 'Texon Invoicing Portal',
            url: `https://github.com/${this.repoOwner}/${this.repoName}`,
            publishedAt: new Date().toISOString(),
            cached: false,
            fallback: true
        };
    }

    /**
     * Clear the cache (useful for testing or forcing refresh)
     */
    clearCache() {
        this.cache.data = null;
        this.cache.timestamp = null;
        console.log('🗑️ GitHub release cache cleared');
    }

    /**
     * Get cache status for debugging
     */
    getCacheStatus() {
        return {
            hasData: !!this.cache.data,
            timestamp: this.cache.timestamp,
            isValid: this.isCacheValid(),
            ttl: this.cache.ttl,
            ageMs: this.cache.timestamp ? (Date.now() - this.cache.timestamp) : null
        };
    }
}

module.exports = GitHubService;