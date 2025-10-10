export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
          
          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>
              <p className="mb-3">
                AstroWorld collects the following information to provide personalized astrological services:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Personal information (name, date of birth, time of birth, place of birth)</li>
                <li>Contact information (email address, phone number)</li>
                <li>Astrological preferences and interests</li>
                <li>Usage data and interactions with our service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">How We Use Your Information</h2>
              <p className="mb-3">We use your information to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide personalized astrological readings and predictions</li>
                <li>Send SMS notifications (only with your explicit consent)</li>
                <li>Improve our services and user experience</li>
                <li>Communicate important updates about our service</li>
                <li>Ensure the security and integrity of our platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">SMS Communications</h2>
              <p>
                We will only send SMS messages to users who have explicitly opted in to receive them. 
                You can opt out at any time by texting STOP. We do not share your phone number with 
                third parties for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Data Security</h2>
              <p>
                We implement appropriate security measures to protect your personal information against 
                unauthorized access, alteration, disclosure, or destruction. Your data is encrypted 
                and stored securely.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Information Sharing</h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal information to third parties 
                without your consent, except as described in this policy or as required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Your Rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of SMS communications</li>
                <li>Request a copy of your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Cookies and Tracking</h2>
              <p>
                We use cookies and similar technologies to enhance your experience, analyze usage 
                patterns, and provide personalized content. You can control cookie settings through 
                your browser.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Children's Privacy</h2>
              <p>
                Our service is not intended for children under 13. We do not knowingly collect 
                personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any 
                changes by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <div className="mt-3 ml-4">
                <p>Email: nandinitalwar11@gmail.com</p>
                <p>Address: 237 Vista De Sierra, Los Gatos, CA 95030</p>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
