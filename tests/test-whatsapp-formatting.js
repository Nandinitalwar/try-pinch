// Test WhatsApp formatting fixes - only strikethrough prevention
function fixWhatsAppFormatting(text) {
  let fixed = text
  
  // Only fix strikethrough pattern (~text~) as it often changes meaning unintentionally
  // Keep bold (*text*) and italic (_text_) as they're usually intentional formatting
  
  // Fix strikethrough - add spaces to break the pattern
  fixed = fixed.replace(/~([^~\s][^~]*[^~\s])~/g, '~ $1 ~')
  
  // Fix edge case where single characters get strikethrough
  fixed = fixed.replace(/~(\w)~/g, '~ $1 ~')
  
  return fixed
}

// Test cases
const testMessages = [
  "hello ~friend~ how are you?", // Should become: hello ~ friend ~ how are you?
  "you are *amazing* today!", // Should stay: you are *amazing* today! (bold formatting preserved)
  "this is _really_ important", // Should stay: this is _really_ important (italic preserved)
  "**Mars in Scorpio** is powerful", // Should stay: **Mars in Scorpio** is powerful
  "your Mars_in_Scorpio placement", // Should stay: your Mars_in_Scorpio placement
  "single ~a~ test", // Should become: single ~ a ~ test
  "mixed ~formatting~ with *bold* and _italic_" // Should only fix strikethrough
]

console.log("WhatsApp Formatting Fix Test Results (Strikethrough Only):")
console.log("========================================================")

testMessages.forEach((message, i) => {
  const fixed = fixWhatsAppFormatting(message)
  console.log(`\nTest ${i + 1}:`)
  console.log(`Original: "${message}"`)
  console.log(`Fixed:    "${fixed}"`)
  console.log(`Changed:  ${message !== fixed ? 'YES' : 'NO'}`)
})