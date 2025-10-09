export default function SMSTerms() {
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-8">SMS Terms & Conditions</h1>
          
          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">AstroWorld SMS Program</h2>
              <p>
                By opting in to receive SMS messages from AstroWorld, you agree to receive recurring 
                automated marketing text messages at the phone number provided. Consent is not a 
                condition of purchase.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Message Frequency</h2>
              <p>
                Message frequency varies. You may receive up to 5 messages per week, including 
                astrological predictions, important updates, and promotional offers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Message & Data Rates</h2>
              <p>
                Message and data rates may apply. Check with your mobile carrier for details about 
                your messaging plan and potential charges.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Opt-Out Instructions</h2>
              <p>
                You can opt out at any time by texting <strong>STOP</strong> to any message you receive 
                from AstroWorld. You will receive a confirmation message that you have been unsubscribed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Help</h2>
              <p>
                For help or more information, text <strong>HELP</strong> to any message you receive 
                from AstroWorld, or contact us at support@astroworld.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Supported Carriers</h2>
              <p>
                This service is available on major U.S. carriers including Verizon, AT&T, T-Mobile, 
                Sprint, and others. Message delivery is subject to carrier limitations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Privacy</h2>
              <p>
                Your privacy is important to us. Please review our{' '}
                <a href="/privacy-policy" className="text-purple-400 hover:text-purple-300 underline">
                  Privacy Policy
                </a>{' '}
                to understand how we collect, use, and protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Terms Changes</h2>
              <p>
                AstroWorld reserves the right to modify these terms at any time. Continued 
                participation in the SMS program after changes constitutes acceptance of the new terms.
              </p>
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
