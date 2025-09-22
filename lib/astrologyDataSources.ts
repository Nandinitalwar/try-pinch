// Comprehensive Astrology Data Aggregated from Multiple Indian Astrology Sources
// This data represents the most commonly accepted interpretations across various Indian astrology websites

export interface StarSignData {
  english: string
  sanskrit: string
  element: string
  quality: string
  ruler: string
  luckyNumbers: number[]
  luckyColors: string[]
  luckyDays: string[]
  unluckyDays: string[]
  compatibleSigns: string[]
  incompatibleSigns: string[]
  strengths: string[]
  weaknesses: string[]
  careerPaths: string[]
  healthAreas: string[]
  loveTraits: string[]
  gemstones: string[]
  mantras: string[]
  remedies: string[]
  personality: string
  dailyRoutine: string
  spiritualPath: string
}

export const STAR_SIGNS_DATA: Record<string, StarSignData> = {
  'Aries (Mesha)': {
    english: 'Aries',
    sanskrit: 'Mesha',
    element: 'Fire',
    quality: 'Cardinal',
    ruler: 'Mars (Mangal)',
    luckyNumbers: [1, 9, 17, 21, 28],
    luckyColors: ['Red', 'Orange', 'Scarlet', 'Crimson'],
    luckyDays: ['Tuesday', 'Sunday'],
    unluckyDays: ['Friday'],
    compatibleSigns: ['Leo', 'Sagittarius', 'Gemini', 'Aquarius'],
    incompatibleSigns: ['Cancer', 'Capricorn', 'Libra'],
    strengths: [
      'Natural leadership qualities',
      'Courage and bravery',
      'High energy and enthusiasm',
      'Direct and honest communication',
      'Quick decision making',
      'Pioneering spirit'
    ],
    weaknesses: [
      'Impatience and impulsiveness',
      'Aggressive nature',
      'Lack of patience',
      'Tendency to be argumentative',
      'Self-centered at times'
    ],
    careerPaths: [
      'Entrepreneur/Business Owner',
      'Sales and Marketing',
      'Sports and Athletics',
      'Military and Police',
      'Engineering',
      'Firefighting',
      'Adventure Sports'
    ],
    healthAreas: [
      'Head and face',
      'Eyes and vision',
      'Brain and nervous system',
      'Blood circulation',
      'Muscular system'
    ],
    loveTraits: [
      'Passionate and intense',
      'Direct in expressing feelings',
      'Loyal to partners',
      'Needs excitement and adventure',
      'Protective of loved ones'
    ],
    gemstones: [
      'Red Coral (Moonga)',
      'Ruby (Manik)',
      'Red Jasper',
      'Bloodstone'
    ],
    mantras: [
      'Om Kram Krim Krom Saha Bhomaya Namah',
      'Om Hrim Krim Krom Saha Bhomaya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear red clothes on Tuesdays',
      'Donate red items to temples',
      'Fast on Tuesdays',
      'Chant Hanuman Chalisa',
      'Visit Hanuman temples'
    ],
    personality: 'Aries individuals are natural-born leaders with fiery energy. They are courageous, ambitious, and always ready for action. Their enthusiasm is infectious, and they inspire others with their determination and drive.',
    dailyRoutine: 'Start your day with physical exercise, especially martial arts or running. Meditate on courage and strength. Wear red or orange colors. Practice deep breathing exercises.',
    spiritualPath: 'Focus on developing patience and controlling anger. Practice meditation to balance the fiery energy. Worship Lord Hanuman and Goddess Durga for strength and courage.'
  },

  'Taurus (Vrishabha)': {
    english: 'Taurus',
    sanskrit: 'Vrishabha',
    element: 'Earth',
    quality: 'Fixed',
    ruler: 'Venus (Shukra)',
    luckyNumbers: [2, 6, 15, 24, 33],
    luckyColors: ['Green', 'Pink', 'Light Blue', 'White'],
    luckyDays: ['Friday', 'Monday'],
    unluckyDays: ['Tuesday'],
    compatibleSigns: ['Virgo', 'Capricorn', 'Cancer', 'Pisces'],
    incompatibleSigns: ['Leo', 'Aquarius', 'Scorpio'],
    strengths: [
      'Reliable and trustworthy',
      'Patient and persistent',
      'Practical and grounded',
      'Strong determination',
      'Loyal and devoted',
      'Good financial sense'
    ],
    weaknesses: [
      'Stubborn and inflexible',
      'Resistant to change',
      'Materialistic tendencies',
      'Slow to anger but explosive when angry',
      'Possessive nature'
    ],
    careerPaths: [
      'Banking and Finance',
      'Real Estate',
      'Agriculture and Farming',
      'Interior Design',
      'Music and Arts',
      'Culinary Arts',
      'Luxury Goods'
    ],
    healthAreas: [
      'Throat and neck',
      'Ears and hearing',
      'Thyroid gland',
      'Digestive system',
      'Reproductive organs'
    ],
    loveTraits: [
      'Deeply romantic and sensual',
      'Loyal and committed',
      'Needs security and stability',
      'Expresses love through actions',
      'Patient in relationships'
    ],
    gemstones: [
      'Diamond (Heera)',
      'White Sapphire',
      'Pearl (Moti)',
      'Emerald (Panna)'
    ],
    mantras: [
      'Om Shukraya Namah',
      'Om Hrim Shrim Klim Shukraya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear white clothes on Fridays',
      'Donate white items to temples',
      'Fast on Fridays',
      'Chant Durga Saptashati',
      'Visit Lakshmi temples'
    ],
    personality: 'Taurus individuals are the most reliable and stable of all signs. They are practical, patient, and have a strong connection to the material world. Their determination and loyalty make them excellent friends and partners.',
    dailyRoutine: 'Start your day with gentle stretching and yoga. Practice gratitude meditation. Wear green or pink colors. Include dairy products in your diet.',
    spiritualPath: 'Focus on developing flexibility and letting go of material attachments. Practice meditation on abundance and gratitude. Worship Goddess Lakshmi for prosperity.'
  },

  'Gemini (Mithuna)': {
    english: 'Gemini',
    sanskrit: 'Mithuna',
    element: 'Air',
    quality: 'Mutable',
    ruler: 'Mercury (Budh)',
    luckyNumbers: [3, 7, 12, 16, 21],
    luckyColors: ['Yellow', 'Light Blue', 'Orange', 'Green'],
    luckyDays: ['Wednesday', 'Friday'],
    unluckyDays: ['Thursday'],
    compatibleSigns: ['Libra', 'Aquarius', 'Aries', 'Leo'],
    incompatibleSigns: ['Virgo', 'Pisces', 'Sagittarius'],
    strengths: [
      'Excellent communication skills',
      'Quick thinking and learning',
      'Adaptable and versatile',
      'Intellectual curiosity',
      'Social and friendly',
      'Multi-talented'
    ],
    weaknesses: [
      'Restless and easily bored',
      'Inconsistent and unreliable',
      'Overthinking and anxiety',
      'Difficulty in decision making',
      'Superficial at times'
    ],
    careerPaths: [
      'Journalism and Media',
      'Teaching and Education',
      'Public Relations',
      'Sales and Marketing',
      'Writing and Publishing',
      'Travel and Tourism',
      'Technology'
    ],
    healthAreas: [
      'Lungs and respiratory system',
      'Nervous system',
      'Arms and shoulders',
      'Brain and mental health',
      'Skin'
    ],
    loveTraits: [
      'Intellectual connection important',
      'Needs mental stimulation',
      'Playful and flirtatious',
      'Enjoys variety and excitement',
      'Good at communication in relationships'
    ],
    gemstones: [
      'Emerald (Panna)',
      'Yellow Sapphire',
      'Citrine',
      'Tiger Eye'
    ],
    mantras: [
      'Om Budhaya Namah',
      'Om Hrim Shrim Klim Budhaya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear green clothes on Wednesdays',
      'Donate green items to temples',
      'Fast on Wednesdays',
      'Chant Gayatri Mantra',
      'Visit Saraswati temples'
    ],
    personality: 'Gemini individuals are the communicators of the zodiac. They are intelligent, curious, and always seeking new information. Their versatility and adaptability make them excellent at multitasking and learning new skills.',
    dailyRoutine: 'Start your day with breathing exercises and pranayama. Practice mindfulness meditation. Wear yellow or green colors. Read something new daily.',
    spiritualPath: 'Focus on developing consistency and depth. Practice meditation on concentration and focus. Worship Goddess Saraswati for wisdom and knowledge.'
  },

  'Cancer (Karka)': {
    english: 'Cancer',
    sanskrit: 'Karka',
    element: 'Water',
    quality: 'Cardinal',
    ruler: 'Moon (Chandra)',
    luckyNumbers: [2, 7, 11, 16, 20],
    luckyColors: ['White', 'Silver', 'Pale Blue', 'Cream'],
    luckyDays: ['Monday', 'Thursday'],
    unluckyDays: ['Saturday'],
    compatibleSigns: ['Scorpio', 'Pisces', 'Taurus', 'Virgo'],
    incompatibleSigns: ['Aries', 'Libra', 'Capricorn'],
    strengths: [
      'Highly intuitive and emotional',
      'Nurturing and caring',
      'Strong family bonds',
      'Excellent memory',
      'Protective nature',
      'Deep emotional intelligence'
    ],
    weaknesses: [
      'Overly emotional and moody',
      'Insecurity and self-doubt',
      'Holding onto the past',
      'Overprotective tendencies',
      'Difficulty in letting go'
    ],
    careerPaths: [
      'Nursing and Healthcare',
      'Childcare and Education',
      'Psychology and Counseling',
      'Real Estate',
      'Food and Hospitality',
      'Social Work',
      'Interior Design'
    ],
    healthAreas: [
      'Stomach and digestive system',
      'Breasts and chest',
      'Emotional health',
      'Lymphatic system',
      'Water retention'
    ],
    loveTraits: [
      'Deeply emotional and romantic',
      'Needs security and commitment',
      'Very loyal and devoted',
      'Expresses love through care',
      'Sensitive to partner\'s needs'
    ],
    gemstones: [
      'Pearl (Moti)',
      'Moonstone',
      'White Sapphire',
      'Opal'
    ],
    mantras: [
      'Om Somaya Namah',
      'Om Hrim Shrim Klim Somaya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear white clothes on Mondays',
      'Donate white items to temples',
      'Fast on Mondays',
      'Chant Chandra Mantra',
      'Visit Shiva temples'
    ],
    personality: 'Cancer individuals are the nurturers of the zodiac. They are deeply emotional, intuitive, and have a strong connection to family and home. Their caring nature and emotional depth make them excellent caregivers and friends.',
    dailyRoutine: 'Start your day with gentle yoga and meditation. Practice emotional healing meditation. Wear white or silver colors. Include dairy and water-rich foods.',
    spiritualPath: 'Focus on developing emotional balance and letting go of past hurts. Practice meditation on emotional healing. Worship Lord Shiva for emotional strength.'
  },

  'Leo (Simha)': {
    english: 'Leo',
    sanskrit: 'Simha',
    element: 'Fire',
    quality: 'Fixed',
    ruler: 'Sun (Surya)',
    luckyNumbers: [1, 4, 10, 22, 28],
    luckyColors: ['Gold', 'Orange', 'Red', 'Purple'],
    luckyDays: ['Sunday', 'Tuesday'],
    unluckyDays: ['Saturday'],
    compatibleSigns: ['Aries', 'Sagittarius', 'Gemini', 'Libra'],
    incompatibleSigns: ['Taurus', 'Scorpio', 'Aquarius'],
    strengths: [
      'Natural leadership and charisma',
      'Generous and warm-hearted',
      'Creative and artistic',
      'Loyal and protective',
      'Confident and courageous',
      'Inspiring to others'
    ],
    weaknesses: [
      'Ego and pride',
      'Need for constant attention',
      'Stubborn and inflexible',
      'Can be dominating',
      'Sensitive to criticism'
    ],
    careerPaths: [
      'Entertainment and Performing Arts',
      'Leadership and Management',
      'Politics and Public Service',
      'Fashion and Design',
      'Education and Training',
      'Sales and Marketing',
      'Entrepreneurship'
    ],
    healthAreas: [
      'Heart and circulatory system',
      'Back and spine',
      'Eyes and vision',
      'Vitality and energy',
      'Immune system'
    ],
    loveTraits: [
      'Romantic and passionate',
      'Loyal and devoted',
      'Needs admiration and appreciation',
      'Generous with love',
      'Protective of partners'
    ],
    gemstones: [
      'Ruby (Manik)',
      'Amber',
      'Tiger Eye',
      'Citrine'
    ],
    mantras: [
      'Om Suryaya Namah',
      'Om Hrim Shrim Klim Suryaya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear red or gold clothes on Sundays',
      'Donate red items to temples',
      'Fast on Sundays',
      'Chant Surya Mantra',
      'Visit Sun temples'
    ],
    personality: 'Leo individuals are the kings and queens of the zodiac. They are confident, charismatic, and natural leaders. Their generosity and warm heart make them beloved by many, and their creativity inspires others.',
    dailyRoutine: 'Start your day with sun salutations and power yoga. Practice confidence meditation. Wear gold or orange colors. Face the sun during sunrise.',
    spiritualPath: 'Focus on developing humility and serving others. Practice meditation on inner strength and confidence. Worship Lord Surya for vitality and leadership.'
  },

  'Virgo (Kanya)': {
    english: 'Virgo',
    sanskrit: 'Kanya',
    element: 'Earth',
    quality: 'Mutable',
    ruler: 'Mercury (Budh)',
    luckyNumbers: [5, 14, 15, 23, 32],
    luckyColors: ['Green', 'Brown', 'Yellow', 'White'],
    luckyDays: ['Wednesday', 'Saturday'],
    unluckyDays: ['Thursday'],
    compatibleSigns: ['Taurus', 'Capricorn', 'Cancer', 'Scorpio'],
    incompatibleSigns: ['Gemini', 'Sagittarius', 'Pisces'],
    strengths: [
      'Analytical and practical',
      'Attention to detail',
      'Reliable and hardworking',
      'Intelligent and logical',
      'Helpful and service-oriented',
      'Organized and efficient'
    ],
    weaknesses: [
      'Overly critical and perfectionist',
      'Worry and anxiety',
      'Difficulty in relaxing',
      'Self-sacrificing tendencies',
      'Can be overly modest'
    ],
    careerPaths: [
      'Healthcare and Medicine',
      'Accounting and Finance',
      'Research and Analysis',
      'Quality Control',
      'Administration',
      'Library Science',
      'Environmental Science'
    ],
    healthAreas: [
      'Digestive system',
      'Nervous system',
      'Intestines',
      'Mental health',
      'Skin and allergies'
    ],
    loveTraits: [
      'Practical and realistic in love',
      'Shows love through service',
      'Loyal and committed',
      'Needs intellectual connection',
      'Patient and understanding'
    ],
    gemstones: [
      'Emerald (Panna)',
      'Jade',
      'Peridot',
      'Moss Agate'
    ],
    mantras: [
      'Om Budhaya Namah',
      'Om Hrim Shrim Klim Budhaya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear green clothes on Wednesdays',
      'Donate green items to temples',
      'Fast on Wednesdays',
      'Chant Gayatri Mantra',
      'Visit Saraswati temples'
    ],
    personality: 'Virgo individuals are the perfectionists of the zodiac. They are analytical, practical, and have a strong desire to be of service to others. Their attention to detail and reliability make them excellent in any field requiring precision.',
    dailyRoutine: 'Start your day with systematic planning and organization. Practice analytical meditation. Wear green or brown colors. Maintain a clean and organized environment.',
    spiritualPath: 'Focus on developing self-compassion and accepting imperfection. Practice meditation on service and humility. Worship Goddess Saraswati for wisdom and knowledge.'
  },

  'Libra (Tula)': {
    english: 'Libra',
    sanskrit: 'Tula',
    element: 'Air',
    quality: 'Cardinal',
    ruler: 'Venus (Shukra)',
    luckyNumbers: [6, 7, 8, 15, 24],
    luckyColors: ['Pink', 'Light Blue', 'Lavender', 'White'],
    luckyDays: ['Friday', 'Monday'],
    unluckyDays: ['Tuesday'],
    compatibleSigns: ['Gemini', 'Aquarius', 'Leo', 'Sagittarius'],
    incompatibleSigns: ['Aries', 'Cancer', 'Capricorn'],
    strengths: [
      'Diplomatic and fair-minded',
      'Social and charming',
      'Artistic and creative',
      'Peace-loving and harmonious',
      'Good sense of justice',
      'Excellent taste and style'
    ],
    weaknesses: [
      'Indecisive and easily influenced',
      'Conflict avoidance',
      'People-pleasing tendencies',
      'Can be superficial',
      'Difficulty in making decisions'
    ],
    careerPaths: [
      'Law and Justice',
      'Diplomacy and International Relations',
      'Fashion and Design',
      'Public Relations',
      'Interior Design',
      'Human Resources',
      'Arts and Culture'
    ],
    healthAreas: [
      'Kidneys and urinary system',
      'Lower back',
      'Skin and beauty',
      'Balance and coordination',
      'Endocrine system'
    ],
    loveTraits: [
      'Romantic and idealistic',
      'Needs harmony in relationships',
      'Fair and just in love',
      'Appreciates beauty and romance',
      'Good at compromise'
    ],
    gemstones: [
      'Diamond (Heera)',
      'Opal',
      'Rose Quartz',
      'Lapis Lazuli'
    ],
    mantras: [
      'Om Shukraya Namah',
      'Om Hrim Shrim Klim Shukraya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear pink or light blue clothes on Fridays',
      'Donate beautiful items to temples',
      'Fast on Fridays',
      'Chant Durga Saptashati',
      'Visit Lakshmi temples'
    ],
    personality: 'Libra individuals are the diplomats of the zodiac. They are fair-minded, social, and have a natural sense of justice. Their charm and artistic nature make them excellent mediators and peacemakers.',
    dailyRoutine: 'Start your day with balance exercises and yoga. Practice harmony meditation. Wear pink or light blue colors. Surround yourself with beauty and art.',
    spiritualPath: 'Focus on developing inner balance and decision-making skills. Practice meditation on harmony and justice. Worship Goddess Lakshmi for beauty and prosperity.'
  },

  'Scorpio (Vrishchika)': {
    english: 'Scorpio',
    sanskrit: 'Vrishchika',
    element: 'Water',
    quality: 'Fixed',
    ruler: 'Mars (Mangal) and Pluto',
    luckyNumbers: [4, 8, 11, 18, 22],
    luckyColors: ['Deep Red', 'Black', 'Maroon', 'Dark Blue'],
    luckyDays: ['Tuesday', 'Thursday'],
    unluckyDays: ['Friday'],
    compatibleSigns: ['Cancer', 'Pisces', 'Virgo', 'Capricorn'],
    incompatibleSigns: ['Taurus', 'Leo', 'Aquarius'],
    strengths: [
      'Intense and passionate',
      'Deeply intuitive and perceptive',
      'Determined and focused',
      'Loyal and protective',
      'Excellent at keeping secrets',
      'Strong willpower'
    ],
    weaknesses: [
      'Jealous and possessive',
      'Secretive and suspicious',
      'Can be vengeful',
      'Emotionally intense',
      'Difficulty in trusting others'
    ],
    careerPaths: [
      'Psychology and Research',
      'Detective and Investigation',
      'Surgery and Medicine',
      'Mysticism and Occult',
      'Security and Intelligence',
      'Archaeology',
      'Deep Sea Exploration'
    ],
    healthAreas: [
      'Reproductive organs',
      'Large intestine',
      'Nose and sinuses',
      'Emotional health',
      'Digestive system'
    ],
    loveTraits: [
      'Intensely passionate and loyal',
      'Deep emotional connection needed',
      'Jealous and possessive',
      'Very committed and devoted',
      'Needs trust and honesty'
    ],
    gemstones: [
      'Red Coral (Moonga)',
      'Black Onyx',
      'Garnet',
      'Obsidian'
    ],
    mantras: [
      'Om Kram Krim Krom Saha Bhomaya Namah',
      'Om Hrim Krim Krom Saha Bhomaya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear red clothes on Tuesdays',
      'Donate red items to temples',
      'Fast on Tuesdays',
      'Chant Hanuman Chalisa',
      'Visit Hanuman temples'
    ],
    personality: 'Scorpio individuals are the most intense and mysterious of the zodiac. They are deeply emotional, intuitive, and have a powerful presence. Their determination and loyalty make them excellent friends and partners.',
    dailyRoutine: 'Start your day with intense physical exercise and meditation. Practice emotional healing meditation. Wear deep red or black colors. Practice deep breathing exercises.',
    spiritualPath: 'Focus on developing trust and letting go of jealousy. Practice meditation on transformation and rebirth. Worship Lord Hanuman for strength and courage.'
  },

  'Sagittarius (Dhanu)': {
    english: 'Sagittarius',
    sanskrit: 'Dhanu',
    element: 'Fire',
    quality: 'Mutable',
    ruler: 'Jupiter (Guru)',
    luckyNumbers: [3, 7, 9, 12, 21],
    luckyColors: ['Purple', 'Blue', 'Red', 'Orange'],
    luckyDays: ['Thursday', 'Sunday'],
    unluckyDays: ['Wednesday'],
    compatibleSigns: ['Aries', 'Leo', 'Gemini', 'Libra'],
    incompatibleSigns: ['Virgo', 'Pisces', 'Cancer'],
    strengths: [
      'Optimistic and enthusiastic',
      'Adventurous and freedom-loving',
      'Honest and straightforward',
      'Philosophical and wise',
      'Generous and kind-hearted',
      'Natural teachers'
    ],
    weaknesses: [
      'Impatient and restless',
      'Can be tactless and blunt',
      'Overly optimistic',
      'Difficulty in commitment',
      'Tendency to overpromise'
    ],
    careerPaths: [
      'Teaching and Education',
      'Travel and Tourism',
      'Philosophy and Religion',
      'Publishing and Media',
      'Sports and Athletics',
      'Law and Justice',
      'International Business'
    ],
    healthAreas: [
      'Hips and thighs',
      'Liver and blood',
      'Nervous system',
      'Vision and eyes',
      'Metabolism'
    ],
    loveTraits: [
      'Optimistic and adventurous in love',
      'Needs freedom and space',
      'Honest and direct',
      'Enjoys intellectual connection',
      'Generous with love'
    ],
    gemstones: [
      'Yellow Sapphire (Pukhraj)',
      'Amethyst',
      'Lapis Lazuli',
      'Turquoise'
    ],
    mantras: [
      'Om Gurave Namah',
      'Om Hrim Shrim Klim Gurave Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear yellow clothes on Thursdays',
      'Donate yellow items to temples',
      'Fast on Thursdays',
      'Chant Guru Mantra',
      'Visit Guru temples'
    ],
    personality: 'Sagittarius individuals are the adventurers and philosophers of the zodiac. They are optimistic, freedom-loving, and always seeking knowledge and new experiences. Their wisdom and generosity make them excellent teachers and friends.',
    dailyRoutine: 'Start your day with outdoor activities and adventure. Practice wisdom meditation. Wear purple or blue colors. Read philosophical or spiritual texts.',
    spiritualPath: 'Focus on developing patience and commitment. Practice meditation on wisdom and knowledge. Worship Lord Guru for wisdom and spiritual growth.'
  },

  'Capricorn (Makara)': {
    english: 'Capricorn',
    sanskrit: 'Makara',
    element: 'Earth',
    quality: 'Cardinal',
    ruler: 'Saturn (Shani)',
    luckyNumbers: [4, 8, 13, 17, 22],
    luckyColors: ['Black', 'Brown', 'Dark Green', 'Gray'],
    luckyDays: ['Saturday', 'Wednesday'],
    unluckyDays: ['Sunday'],
    compatibleSigns: ['Taurus', 'Virgo', 'Scorpio', 'Pisces'],
    incompatibleSigns: ['Aries', 'Libra', 'Cancer'],
    strengths: [
      'Ambitious and disciplined',
      'Responsible and reliable',
      'Patient and practical',
      'Excellent organizational skills',
      'Determined and persistent',
      'Good financial management'
    ],
    weaknesses: [
      'Can be pessimistic',
      'Rigid and inflexible',
      'Workaholic tendencies',
      'Difficulty in expressing emotions',
      'Can be overly serious'
    ],
    careerPaths: [
      'Business and Management',
      'Finance and Banking',
      'Engineering and Architecture',
      'Government and Politics',
      'Law and Justice',
      'Real Estate',
      'Agriculture'
    ],
    healthAreas: [
      'Bones and joints',
      'Teeth and gums',
      'Skin and hair',
      'Nervous system',
      'Digestive system'
    ],
    loveTraits: [
      'Loyal and committed',
      'Shows love through actions',
      'Needs security and stability',
      'Patient and understanding',
      'Practical in relationships'
    ],
    gemstones: [
      'Blue Sapphire (Neelam)',
      'Black Onyx',
      'Jet',
      'Obsidian'
    ],
    mantras: [
      'Om Sham Shanaischaraya Namah',
      'Om Hrim Shrim Klim Sham Shanaischaraya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear black clothes on Saturdays',
      'Donate black items to temples',
      'Fast on Saturdays',
      'Chant Shani Mantra',
      'Visit Shani temples'
    ],
    personality: 'Capricorn individuals are the most ambitious and disciplined of the zodiac. They are responsible, practical, and have excellent organizational skills. Their determination and patience help them achieve their long-term goals.',
    dailyRoutine: 'Start your day with structured planning and goal setting. Practice discipline meditation. Wear black or brown colors. Maintain a strict routine.',
    spiritualPath: 'Focus on developing emotional expression and flexibility. Practice meditation on discipline and patience. Worship Lord Shani for discipline and karma.'
  },

  'Aquarius (Kumbha)': {
    english: 'Aquarius',
    sanskrit: 'Kumbha',
    element: 'Air',
    quality: 'Fixed',
    ruler: 'Saturn (Shani) and Uranus',
    luckyNumbers: [4, 7, 11, 22, 29],
    luckyColors: ['Electric Blue', 'Turquoise', 'Silver', 'White'],
    luckyDays: ['Saturday', 'Wednesday'],
    unluckyDays: ['Sunday'],
    compatibleSigns: ['Gemini', 'Libra', 'Aries', 'Sagittarius'],
    incompatibleSigns: ['Taurus', 'Scorpio', 'Leo'],
    strengths: [
      'Innovative and original',
      'Humanitarian and idealistic',
      'Intellectual and analytical',
      'Independent and freedom-loving',
      'Progressive thinking',
      'Unique perspective'
    ],
    weaknesses: [
      'Can be detached and aloof',
      'Stubborn and rebellious',
      'Difficulty in emotional expression',
      'Can be unpredictable',
      'Tendency to be eccentric'
    ],
    careerPaths: [
      'Technology and Innovation',
      'Science and Research',
      'Social Work and Activism',
      'Astrology and Occult',
      'Environmental Science',
      'Alternative Medicine',
      'Space and Aviation'
    ],
    healthAreas: [
      'Circulatory system',
      'Nervous system',
      'Ankles and lower legs',
      'Mental health',
      'Electrical impulses'
    ],
    loveTraits: [
      'Needs intellectual connection',
      'Values independence',
      'Unconventional in love',
      'Loyal to friends and partners',
      'Shows love through ideas'
    ],
    gemstones: [
      'Blue Sapphire (Neelam)',
      'Amethyst',
      'Aquamarine',
      'Lapis Lazuli'
    ],
    mantras: [
      'Om Sham Shanaischaraya Namah',
      'Om Hrim Shrim Klim Sham Shanaischaraya Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear blue clothes on Saturdays',
      'Donate blue items to temples',
      'Fast on Saturdays',
      'Chant Shani Mantra',
      'Visit Shani temples'
    ],
    personality: 'Aquarius individuals are the visionaries and innovators of the zodiac. They are humanitarian, intellectual, and always thinking ahead. Their unique perspective and progressive thinking make them excellent inventors and social reformers.',
    dailyRoutine: 'Start your day with innovative thinking and brainstorming. Practice intellectual meditation. Wear electric blue or turquoise colors. Engage in social causes.',
    spiritualPath: 'Focus on developing emotional connection and empathy. Practice meditation on innovation and humanitarian values. Worship Lord Shani for discipline and unique thinking.'
  },

  'Pisces (Meena)': {
    english: 'Pisces',
    sanskrit: 'Meena',
    element: 'Water',
    quality: 'Mutable',
    ruler: 'Jupiter (Guru) and Neptune',
    luckyNumbers: [3, 7, 12, 16, 21],
    luckyColors: ['Sea Green', 'Purple', 'Blue', 'White'],
    luckyDays: ['Thursday', 'Monday'],
    unluckyDays: ['Wednesday'],
    compatibleSigns: ['Cancer', 'Scorpio', 'Taurus', 'Capricorn'],
    incompatibleSigns: ['Gemini', 'Virgo', 'Sagittarius'],
    strengths: [
      'Highly intuitive and psychic',
      'Compassionate and empathetic',
      'Creative and artistic',
      'Spiritual and mystical',
      'Adaptable and flexible',
      'Deep emotional understanding'
    ],
    weaknesses: [
      'Overly emotional and sensitive',
      'Easily influenced',
      'Escapist tendencies',
      'Difficulty in practical matters',
      'Can be overly idealistic'
    ],
    careerPaths: [
      'Arts and Creative Fields',
      'Spirituality and Religion',
      'Psychology and Counseling',
      'Healing and Alternative Medicine',
      'Music and Dance',
      'Charity and Social Work',
      'Marine Biology'
    ],
    healthAreas: [
      'Feet and toes',
      'Lymphatic system',
      'Immune system',
      'Emotional health',
      'Water retention'
    ],
    loveTraits: [
      'Deeply romantic and idealistic',
      'Very intuitive about partners',
      'Needs emotional security',
      'Shows love through empathy',
      'Very loyal and devoted'
    ],
    gemstones: [
      'Yellow Sapphire (Pukhraj)',
      'Pearl (Moti)',
      'Aquamarine',
      'Moonstone'
    ],
    mantras: [
      'Om Gurave Namah',
      'Om Hrim Shrim Klim Gurave Namah',
      'Om Namah Shivaya'
    ],
    remedies: [
      'Wear yellow or sea green clothes on Thursdays',
      'Donate yellow items to temples',
      'Fast on Thursdays',
      'Chant Guru Mantra',
      'Visit Guru temples'
    ],
    personality: 'Pisces individuals are the most spiritual and intuitive of the zodiac. They are compassionate, artistic, and have a deep connection to the spiritual realm. Their empathy and creativity make them excellent healers and artists.',
    dailyRoutine: 'Start your day with spiritual practices and meditation. Practice intuitive meditation. Wear sea green or purple colors. Connect with water elements.',
    spiritualPath: 'Focus on developing practical skills and boundaries. Practice meditation on spiritual connection and intuition. Worship Lord Guru for wisdom and spiritual growth.'
  }
}

// Get comprehensive data for a specific star sign
export function getStarSignData(starSign: string): StarSignData | null {
  return STAR_SIGNS_DATA[starSign] || null
}

// Get all star signs
export function getAllStarSigns(): string[] {
  return Object.keys(STAR_SIGNS_DATA)
}

// Get compatible signs for a star sign
export function getCompatibleSigns(starSign: string): string[] {
  const data = getStarSignData(starSign)
  return data?.compatibleSigns || []
}

// Get gemstones for a star sign
export function getGemstones(starSign: string): string[] {
  const data = getStarSignData(starSign)
  return data?.gemstones || []
}

// Get daily routine for a star sign
export function getDailyRoutine(starSign: string): string {
  const data = getStarSignData(starSign)
  return data?.dailyRoutine || ''
}

// Get spiritual path for a star sign
export function getSpiritualPath(starSign: string): string {
  const data = getStarSignData(starSign)
  return data?.spiritualPath || ''
} 