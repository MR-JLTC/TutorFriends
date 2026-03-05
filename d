[1mdiff --git a/components/Tutor_TuteePages/LandingPage.tsx b/components/Tutor_TuteePages/LandingPage.tsx[m
[1mindex ce419c4..50f5820 100644[m
[1m--- a/components/Tutor_TuteePages/LandingPage.tsx[m
[1m+++ b/components/Tutor_TuteePages/LandingPage.tsx[m
[36m@@ -34,39 +34,37 @@[m [mconst LiveStats: React.FC = () => {[m
 [m
   useEffect(() => {[m
     let mounted = true;[m
[32m+[m[32m    let intervalId: NodeJS.Timeout | null = null;[m
[32m+[m[32m    let hasFailed = false;[m
 [m
[31m-    // Function to fetch stats[m
[31m-    // Function to fetch stats[m
     const fetchStats = async () => {[m
[32m+[m[32m      if (hasFailed) return;[m
       try {[m
[31m-        // Use apiClient which correctly handles the base URL from environment variables[m
[31m-        // whether it's a full URL (https://...) or just an IP[m
         const res = await apiClient.get(`/landing/stats?_t=${Date.now()}`);[m
 [m
         if (mounted) {[m
           setStats(res.data);[m
[31m-          setError(null); // Clear any previous errors[m
[32m+[m[32m          setError(null);[m
         }[m
       } catch (e: any) {[m
         if (mounted) {[m
[31m-          // On initial load, show error. on subsequent polls, maybe stay silent or log[m
[31m-          // But here we rely on state. If we already have stats, maybe just keep them.[m
[31m-          if (!stats) setError(e.message || 'Failed to load stats');[m
[32m+[m[32m          if (!stats) setError('Failed to load stats (backend offline)');[m
[32m+[m[32m        }[m
[32m+[m[32m        if (e.isNetworkError || e.message === 'Network Error') {[m
[32m+[m[32m          hasFailed = true;[m
[32m+[m[32m          if (intervalId) clearInterval(intervalId);[m
         }[m
       }[m
     };[m
 [m
[31m-    // Initial fetch[m
     fetchStats();[m
[31m-[m
[31m-    // Poll every 1 second for "lively" updates[m
[31m-    const intervalId = setInterval(fetchStats, 1000);[m
[32m+[m[32m    intervalId = setInterval(fetchStats, 5000); // Polling reduced[m
 [m
     return () => {[m
       mounted = false;[m
[31m-      clearInterval(intervalId);[m
[32m+[m[32m      if (intervalId) clearInterval(intervalId);[m
     };[m
[31m-  }, []); // Remove dependency on 'stats' to avoid resetting interval constantly, or just leave empty deps[m
[32m+[m[32m  }, []);[m
 [m
   return ([m
     <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-24">[m
[36m@@ -468,25 +466,23 @@[m [mconst LandingPage: React.FC = () => {[m
 [m
   useEffect(() => {[m
     let mounted = true;[m
[32m+[m[32m    let intervalId: NodeJS.Timeout | null = null;[m
[32m+[m[32m    let hasFailed = false;[m
 [m
     const fetchUniversities = async () => {[m
[32m+[m[32m      if (hasFailed) return;[m
       try {[m
[31m-        // We use apiClient here since it might handle some base URL stuff, [m
[31m-        // though typically for polling we might want to avoid interceptor overhead if it fails often.[m
[31m-        // But for consistency:[m
[31m-        // Add timestamp to query to prevent caching[m
         const res = await apiClient.get(`/universities?_t=${Date.now()}`);[m
 [m
         if (mounted) {[m
           const rows = Array.isArray(res.data) ? res.data : [];[m
           const active = rows.filter((u: any) => (u.status || 'active') === 'active');[m
[31m-          // Only update if data changed (optional optimization, but React handles diffing well enough for small lists)[m
           setPartnerUniversities(active);[m
         }[m
[31m-      } catch (err) {[m
[31m-        // Silent failure on polling[m
[31m-        if (mounted) {[m
[31m-          // console.error('Failed to fetch universities:', err);[m
[32m+[m[32m      } catch (err: any) {[m
[32m+[m[32m        if (err.isNetworkError || err.message === 'Network Error') {[m
[32m+[m[32m          hasFailed = true;[m
[32m+[m[32m          if (intervalId) clearInterval(intervalId);[m
         }[m
       } finally {[m
         if (mounted) {[m
[36m@@ -496,11 +492,11 @@[m [mconst LandingPage: React.FC = () => {[m
     };[m
 [m
     fetchUniversities();[m
[31m-    const intervalId = setInterval(fetchUniversities, 1000); // Poll every 1 second[m
[32m+[m[32m    intervalId = setInterval(fetchUniversities, 5000); // Polling reduced for local view[m
 [m
     return () => {[m
       mounted = false;[m
[31m-      clearInterval(intervalId);[m
[32m+[m[32m      if (intervalId) clearInterval(intervalId);[m
     };[m
   }, []);[m
 [m
