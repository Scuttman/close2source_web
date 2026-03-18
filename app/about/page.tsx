import PageShell from "../../components/PageShell";
import { SparklesIcon, DevicePhoneMobileIcon, ShieldCheckIcon, BoltIcon, HeartIcon, MegaphoneIcon, ShareIcon, DocumentTextIcon, QrCodeIcon } from '@heroicons/react/24/outline';

export default function AboutPage() {
  const values = [
    {
      icon: ShieldCheckIcon,
      title: "Transparency",
      description: "Real-time visibility into grant spending, unfiltered updates from field teams, and complete openness about how funds are used. Partners see exactly what their support unlocks."
    },
    {
      icon: HeartIcon,
      title: "Direct Connection",
      description: "Removing intermediaries between partners and project teams on the ground. Supporters get updates straight from the source without editorial filters or organizational barriers."
    },
    {
      icon: ShieldCheckIcon,
      title: "Accountability",
      description: "Receipt uploads, photo documentation, verified impact tracking, and AI-assisted reporting ensure everyone is accountable for results and spending."
    },
    {
      icon: BoltIcon,
      title: "Efficiency",
      description: "Mobile-first tools for field teams, AI-assisted report generation, and streamlined processes mean less time on paperwork and more time making impact."
    },
    {
      icon: ShieldCheckIcon,
      title: "Trust",
      description: "Built through transparency, accountability, and direct relationships. The code system, QR verification, and real-time tracking create confidence that contributions reach their intended destination."
    }
  ];

  return (
    <PageShell title={<span>About</span>} contentClassName="p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            About <span className="text-brand-main">Close2Source</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Connecting partners and supporters directly with projects and individuals making a difference.
          </p>
        </div>

        {/* Mission */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 md:p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
          <p className="text-lg text-orange-50 leading-relaxed">
            Close2Source bridges the gap between compassionate partners and dedicated project teams in the field. 
            We provide real-time transparency for grant spending and AI-assisted reporting through mobile technology, 
            ensuring that every contribution creates maximum impact and trust is built on complete openness. 
            Beyond transparency, we empower organizations with powerful marketing and communication tools—turning field 
            updates into compelling stories, profiles into professional materials, and impact into lasting relationships.
          </p>
        </div>

        {/* Core Values */}
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Our Core Values</h2>
            <p className="text-gray-600">The principles that guide everything we do</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition border border-gray-100"
              >
                <div className="bg-orange-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How We Work */}
        <div className="bg-gray-50 rounded-2xl p-8 md:p-12 space-y-6">
          <h2 className="text-3xl font-bold text-gray-900">How We Work</h2>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Partners Support Projects</h3>
                <p className="text-gray-600 text-sm">
                  Individuals and organizations discover projects and people they care about, 
                  providing financial support and following their journey.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Field Teams Track Progress</h3>
                <p className="text-gray-600 text-sm">
                  Project staff use our mobile app to track grant spending, upload receipts, 
                  document progress with photos, and provide real-time updates from anywhere.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">AI Assists with Reporting</h3>
                <p className="text-gray-600 text-sm">
                  Our AI tools help generate comprehensive reports and updates, 
                  reducing administrative burden so teams can focus on their mission.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Everyone Stays Connected</h3>
                <p className="text-gray-600 text-sm">
                  Partners receive unfiltered updates, see exactly how funds are used, 
                  and maintain a direct connection with the people making change happen.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Marketing & Communication */}
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Built-In Marketing & Communication Tools
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Close2Source isn't just about transparency—it's a powerful marketing and communication platform 
              that helps you tell your story, engage supporters, and grow your impact.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="bg-white/20 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Content Creation</h3>
              <p className="text-purple-50 text-sm leading-relaxed">
                Generate compelling updates, social media posts, newsletters, and impact reports with AI assistance. 
                Turn field data into engaging stories that resonate with supporters.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="bg-white/20 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <DocumentTextIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Professional Profiles</h3>
              <p className="text-blue-50 text-sm leading-relaxed">
                Create polished project and individual profiles that double as marketing materials. 
                Download professional PDFs for grant applications, presentations, and promotional materials.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
              <div className="bg-white/20 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <QrCodeIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Easy Sharing</h3>
              <p className="text-green-50 text-sm leading-relaxed">
                Every project gets a unique code and QR code for instant sharing. 
                Share via social media, email, print materials, or scan codes at events for immediate access.
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
              <div className="bg-white/20 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <MegaphoneIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-Time Impact Stories</h3>
              <p className="text-orange-50 text-sm leading-relaxed">
                Field updates with photos and receipts become authentic impact stories. 
                Show supporters exactly what their contributions achieve in real-time, building trust and encouraging ongoing support.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-8 border border-indigo-200">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-500 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0">
                <ShareIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Your Story, Amplified
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  Every feature in Close2Source is designed to make communication effortless. 
                  From AI-generated social posts to downloadable PDFs, from shareable QR codes to real-time photo updates—
                  you get powerful marketing tools without the complexity or cost of traditional marketing platforms. 
                  Spend less time on promotion and more time on impact, while still reaching more supporters than ever before.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Technology */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <DevicePhoneMobileIcon className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Mobile First</h3>
            <p className="text-gray-600 text-sm">
              Field teams update everything directly from their phones, no matter where they are.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <SparklesIcon className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">AI-Powered</h3>
            <p className="text-gray-600 text-sm">
              Intelligent tools help create reports, analyze impact, and communicate progress effortlessly.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <ShieldCheckIcon className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Fully Transparent</h3>
            <p className="text-gray-600 text-sm">
              Every transaction, update, and milestone is visible to partners in real-time.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-white rounded-2xl p-8 border-2 border-orange-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Join Us</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Whether you're a project team in the field or a partner looking to make a difference, 
            Close2Source connects you with the people and causes that matter most.
          </p>
          <div className="flex justify-center">
            <a 
              href="/register" 
              className="inline-block px-8 py-4 bg-orange-500 text-white rounded-full font-semibold hover:bg-orange-600 transition shadow-lg"
            >
              Get Started Today
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
