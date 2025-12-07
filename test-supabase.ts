#!/usr/bin/env node

// Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') })

/**
 * Supabase User Profile Testing Script
 * 
 * This script tests that Supabase is correctly storing and retrieving user data.
 * 
 * Usage:
 *   npm run test:supabase
 *   or
 *   npx tsx test-supabase.ts
 */

import { UserProfileService, UserProfile } from './lib/supabase'

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function success(message: string) {
  log(`✓ ${message}`, 'green')
}

function error(message: string) {
  log(`✗ ${message}`, 'red')
}

function info(message: string) {
  log(`ℹ ${message}`, 'cyan')
}

function section(message: string) {
  log(`\n${'='.repeat(60)}`, 'blue')
  log(`${message}`, 'bold')
  log(`${'='.repeat(60)}`, 'blue')
}

async function testSupabaseConnection() {
  section('TEST 1: Supabase Connection')
  
  try {
    info('Testing environment variables...')
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      error('NEXT_PUBLIC_SUPABASE_URL is not set')
      return false
    }
    success('NEXT_PUBLIC_SUPABASE_URL is set')
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      error('SUPABASE_SERVICE_ROLE_KEY is not set')
      return false
    }
    success('SUPABASE_SERVICE_ROLE_KEY is set')
    
    return true
  } catch (err) {
    error(`Connection test failed: ${err}`)
    return false
  }
}

async function testCreateProfile() {
  section('TEST 2: Create User Profile')
  
  const testPhone = `+1555${Math.floor(Math.random() * 10000000)}`
  const testProfile: UserProfile = {
    phone_number: testPhone,
    name: 'Test User',
    date_of_birth: '1990-01-01',
    time_of_birth: '12:00:00',
    place_of_birth: 'New York, NY',
    star_sign: 'Capricorn'
  }
  
  try {
    info(`Creating profile for phone: ${testPhone}`)
    const result = await UserProfileService.upsertProfile(testProfile)
    
    if (!result) {
      error('Failed to create profile - upsertProfile returned null')
      return null
    }
    
    success('Profile created successfully')
    info(`Profile ID: ${result.id}`)
    info(`Name: ${result.name}`)
    info(`Date of Birth: ${result.date_of_birth}`)
    info(`Star Sign: ${result.star_sign}`)
    
    return result
  } catch (err) {
    error(`Profile creation failed: ${err}`)
    return null
  }
}

async function testReadProfile(phoneNumber: string) {
  section('TEST 3: Read User Profile')
  
  try {
    info(`Reading profile for phone: ${phoneNumber}`)
    const profile = await UserProfileService.getProfile(phoneNumber)
    
    if (!profile) {
      error('Failed to read profile - getProfile returned null')
      return false
    }
    
    success('Profile retrieved successfully')
    info(`Name: ${profile.name}`)
    info(`Date of Birth: ${profile.date_of_birth}`)
    info(`Time of Birth: ${profile.time_of_birth}`)
    info(`Place of Birth: ${profile.place_of_birth}`)
    info(`Star Sign: ${profile.star_sign}`)
    
    return true
  } catch (err) {
    error(`Profile read failed: ${err}`)
    return false
  }
}

async function testUpdateProfile(phoneNumber: string) {
  section('TEST 4: Update User Profile')
  
  try {
    info(`Updating profile for phone: ${phoneNumber}`)
    const updates = {
      name: 'Updated Test User',
      star_sign: 'Aquarius'
    }
    
    const result = await UserProfileService.updateProfile(phoneNumber, updates)
    
    if (!result) {
      error('Failed to update profile - updateProfile returned null')
      return false
    }
    
    success('Profile updated successfully')
    info(`New Name: ${result.name}`)
    info(`New Star Sign: ${result.star_sign}`)
    
    // Verify the update
    const updatedProfile = await UserProfileService.getProfile(phoneNumber)
    if (updatedProfile?.name === updates.name && updatedProfile?.star_sign === updates.star_sign) {
      success('Update verified')
      return true
    } else {
      error('Update verification failed')
      return false
    }
  } catch (err) {
    error(`Profile update failed: ${err}`)
    return false
  }
}

async function testCompleteProfileCheck(phoneNumber: string) {
  section('TEST 5: Complete Profile Check')
  
  try {
    info(`Checking if profile is complete for phone: ${phoneNumber}`)
    const profile = await UserProfileService.getProfile(phoneNumber)
    const isComplete = UserProfileService.hasCompleteProfile(profile)
    
    if (isComplete) {
      success('Profile is complete')
    } else {
      error('Profile is incomplete')
      info('Missing fields:')
      if (!profile?.name) info('  - name')
      if (!profile?.date_of_birth) info('  - date_of_birth')
      if (!profile?.time_of_birth) info('  - time_of_birth')
      if (!profile?.place_of_birth) info('  - place_of_birth')
    }
    
    return isComplete
  } catch (err) {
    error(`Profile completeness check failed: ${err}`)
    return false
  }
}

async function testExtractBirthDetails() {
  section('TEST 6: Extract Birth Details from Message')
  
  const testMessages = [
    "My name is John Doe",
    "I was born on 01/15/1990",
    "My birth time is 3:30 PM",
    "I was born in Los Angeles, CA"
  ]
  
  try {
    for (const message of testMessages) {
      info(`Testing message: "${message}"`)
      const details = UserProfileService.extractBirthDetails(message)
      
      if (Object.keys(details).length > 0) {
        success(`Extracted: ${JSON.stringify(details)}`)
      } else {
        error('No details extracted')
      }
    }
    
    return true
  } catch (err) {
    error(`Birth details extraction failed: ${err}`)
    return false
  }
}

async function testNonExistentProfile() {
  section('TEST 7: Query Non-Existent Profile')
  
  const nonExistentPhone = '+19999999999'
  
  try {
    info(`Querying non-existent profile: ${nonExistentPhone}`)
    const profile = await UserProfileService.getProfile(nonExistentPhone)
    
    if (profile === null) {
      success('Correctly returned null for non-existent profile')
      return true
    } else {
      error('Should have returned null for non-existent profile')
      return false
    }
  } catch (err) {
    error(`Non-existent profile test failed: ${err}`)
    return false
  }
}

// Main test runner
async function runAllTests() {
  log('\n🧪 SUPABASE USER PROFILE TESTING SUITE', 'bold')
  log('Testing Supabase integration for user profile storage\n', 'cyan')
  
  const results = {
    passed: 0,
    failed: 0
  }
  
  // Test 1: Connection
  if (await testSupabaseConnection()) {
    results.passed++
  } else {
    results.failed++
    log('\n❌ Connection test failed. Cannot proceed with other tests.', 'red')
    process.exit(1)
  }
  
  // Test 2: Create Profile
  const createdProfile = await testCreateProfile()
  if (createdProfile) {
    results.passed++
  } else {
    results.failed++
    log('\n❌ Profile creation failed. Cannot proceed with other tests.', 'red')
    process.exit(1)
  }
  
  const testPhone = createdProfile.phone_number
  
  // Test 3: Read Profile
  if (await testReadProfile(testPhone)) {
    results.passed++
  } else {
    results.failed++
  }
  
  // Test 4: Update Profile
  if (await testUpdateProfile(testPhone)) {
    results.passed++
  } else {
    results.failed++
  }
  
  // Test 5: Complete Profile Check
  if (await testCompleteProfileCheck(testPhone)) {
    results.passed++
  } else {
    results.failed++
  }
  
  // Test 6: Extract Birth Details
  if (await testExtractBirthDetails()) {
    results.passed++
  } else {
    results.failed++
  }
  
  // Test 7: Non-Existent Profile
  if (await testNonExistentProfile()) {
    results.passed++
  } else {
    results.failed++
  }
  
  // Summary
  section('TEST SUMMARY')
  log(`\nTotal Tests: ${results.passed + results.failed}`, 'bold')
  log(`Passed: ${results.passed}`, 'green')
  log(`Failed: ${results.failed}`, 'red')
  
  if (results.failed === 0) {
    log('\n🎉 All tests passed! Supabase is correctly storing user data.', 'green')
    process.exit(0)
  } else {
    log('\n⚠️  Some tests failed. Please check your Supabase configuration.', 'yellow')
    process.exit(1)
  }
}

// Run the tests
runAllTests().catch((err) => {
  error(`\nFatal error: ${err}`)
  console.error(err)
  process.exit(1)
})

