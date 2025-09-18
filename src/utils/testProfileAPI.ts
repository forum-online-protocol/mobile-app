import ApiService from '../services/ApiService';

export const testProfileEndpoints = async () => {
  const apiService = ApiService.getInstance();
  
  console.log('🧪 Testing Profile API endpoints...');
  
  // Test address (John Doe demo address)
  const testAddress = '0x742d35Cc6338C0532c741201da69a85B2d2eF7DF';
  
  try {
    // Test 1: Get user profile
    console.log('📋 Testing getUserProfile...');
    const profileResult = await apiService.getUserProfile(testAddress);
    console.log('Profile result:', profileResult);
    
    if (profileResult.success) {
      console.log('✅ Profile data:', {
        address: profileResult.data?.address,
        nickname: profileResult.data?.nickname,
        isVerified: profileResult.data?.isVerified,
        source: profileResult.data?.source
      });
    } else {
      console.log('❌ Profile failed:', profileResult.error);
    }
    
    // Test 2: Get profile summary
    console.log('📋 Testing getProfileSummary...');
    const summaryResult = await apiService.getProfileSummary(testAddress);
    console.log('Summary result:', summaryResult);
    
    // Test 3: Search profiles
    console.log('📋 Testing searchProfiles...');
    const searchResult = await apiService.searchProfiles('Alice', 5);
    console.log('Search result:', searchResult);
    
    // Test 4: Get trending profiles
    console.log('📋 Testing getTrendingProfiles...');
    const trendingResult = await apiService.getTrendingProfiles(5);
    console.log('Trending result:', trendingResult);
    
    // Test 5: Batch profile lookup
    console.log('📋 Testing getBatchProfiles...');
    const batchResult = await apiService.getBatchProfiles([testAddress]);
    console.log('Batch result:', batchResult);
    
    console.log('🎉 Profile API tests completed!');
    
    return {
      profile: profileResult,
      summary: summaryResult,
      search: searchResult,
      trending: trendingResult,
      batch: batchResult
    };
    
  } catch (error) {
    console.error('❌ Profile API test failed:', error);
    return null;
  }
};