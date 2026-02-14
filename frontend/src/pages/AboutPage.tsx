import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Search, Shield, CheckCircle, Building2, 
  TrendingUp, Users, Lock, Eye, Zap, ArrowRight,
  Smartphone, MapPin, MessageSquare, Key
} from 'lucide-react';
import { Button, Card, Badge } from '../components/ui';
import { useAuthStore } from '../store/authStore';

const AboutPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Badge variant="verified" size="lg" className="mb-4">
            <Zap className="w-4 h-4 mr-1" /> ALU Capstone Project
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            How Byaboneka+ Works
          </h1>
          <p className="text-lg text-primary-100 max-w-2xl mx-auto">
            A trust-aware lost and found infrastructure designed specifically for 
            Rwanda's transport ecosystem — reuniting people with their belongings safely.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">The Problem We Solve</h2>
          <div className="prose prose-lg mx-auto text-gray-600">
            <p className="text-center max-w-3xl mx-auto">
              Every day, thousands of Rwandans lose personal belongings on public transport — phones, 
              wallets, IDs, bags, and keys. Without a centralized system, recovering these items relies 
              on informal channels, word of mouth, and luck. Fraud risks make the situation worse, as 
              there's no way to verify rightful ownership.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mt-10">
            {[
              { icon: <Search className="w-6 h-6" />, title: 'No Central System', desc: 'Items reported informally across disconnected channels' },
              { icon: <Shield className="w-6 h-6" />, title: 'Fraud Risk', desc: 'No verification means anyone can claim to own an item' },
              { icon: <Users className="w-6 h-6" />, title: 'Trust Gap', desc: 'No accountability for cooperatives or individuals' },
            ].map((item, i) => (
              <Card key={i} className="p-6 text-center border-red-100 bg-red-50">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-500 mx-auto mb-3">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Step-by-Step Process */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-center">Step-by-Step Process</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            From reporting to recovery, Byaboneka+ guides every step with security and trust built in.
          </p>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'Report Lost or Found Item',
                desc: 'Describe the item with details — category, location, date, and distinctive features. For lost items, you also set verification questions that only the true owner would know.',
                icon: FileText,
                color: 'bg-blue-500',
              },
              {
                step: '02',
                title: 'Smart Matching Engine',
                desc: 'Our algorithm automatically compares lost and found reports using multiple factors: category match, location proximity, time correlation, and keyword overlap. Matches are scored and ranked.',
                icon: Search,
                color: 'bg-purple-500',
              },
              {
                step: '03',
                title: 'Ownership Verification',
                desc: 'To claim a found item, the owner must answer verification questions they set when reporting. A multi-question challenge with limited attempts prevents fraud while protecting legitimate owners.',
                icon: Shield,
                color: 'bg-green-500',
              },
              {
                step: '04',
                title: 'Secure Messaging',
                desc: 'Once verified, owners and finders can communicate through the platform. Messages are monitored for scam indicators, and either party can report suspicious behavior.',
                icon: MessageSquare,
                color: 'bg-yellow-500',
              },
              {
                step: '05',
                title: 'OTP-Secured Handover',
                desc: 'The platform generates a one-time code that the owner shares with the finder at the meeting point. This ensures both parties confirm the physical handover, completing the process securely.',
                icon: Key,
                color: 'bg-orange-500',
              },
              {
                step: '06',
                title: 'Trust Score Update',
                desc: 'After successful returns, both parties earn trust score points. Over time, this builds a reputation system that rewards honest behavior and flags suspicious accounts.',
                icon: TrendingUp,
                color: 'bg-trust-500',
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 sm:gap-6">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 ${item.color} rounded-2xl flex items-center justify-center text-white`}>
                    <item.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-gray-400">{item.step}</span>
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  </div>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-center">Key Features</h2>
          <p className="text-gray-600 text-center mb-10">What makes Byaboneka+ unique</p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Shield className="w-6 h-6" />, title: 'Multi-Question Verification', desc: 'Category-specific ownership proof with strength analysis', color: 'text-green-500', bg: 'bg-green-100' },
              { icon: <Eye className="w-6 h-6" />, title: 'Behavioral Fraud Detection', desc: 'Real-time analysis of user patterns to flag suspicious activity', color: 'text-red-500', bg: 'bg-red-100' },
              { icon: <Lock className="w-6 h-6" />, title: 'Privacy Redaction', desc: 'Automatic detection and masking of sensitive info in descriptions', color: 'text-purple-500', bg: 'bg-purple-100' },
              { icon: <Building2 className="w-6 h-6" />, title: 'Cooperative Accountability', desc: 'Scoring and leaderboard for transport cooperatives', color: 'text-blue-500', bg: 'bg-blue-100' },
              { icon: <MapPin className="w-6 h-6" />, title: 'Safe Handover Locations', desc: 'Recommended meeting points at police stations and cooperative offices', color: 'text-orange-500', bg: 'bg-orange-100' },
              { icon: <Smartphone className="w-6 h-6" />, title: 'Duplicate Detection', desc: 'Prevents double-reporting with similarity scoring before submission', color: 'text-yellow-600', bg: 'bg-yellow-100' },
            ].map((feature, i) => (
              <Card key={i} className="p-6">
                <div className={`w-12 h-12 ${feature.bg} rounded-xl flex items-center justify-center ${feature.color} mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Built With</h2>
          <p className="text-gray-600 mb-8">Modern, production-grade technology stack</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['React', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Express', 'PostgreSQL', 'JWT Auth', 'Zustand', 'Zod', 'Docker', 'Swagger'].map((tech) => (
              <span key={tech} className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to Try It?</h2>
          <p className="text-primary-100 mb-8">Start using Byaboneka+ to find your lost belongings</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard"><Button size="lg" variant="accent">Go to Dashboard</Button></Link>
                <Link to="/search"><Button size="lg" variant="secondary" className="bg-white/10 border-white/30 text-white hover:bg-white/20">Search Items</Button></Link>
              </>
            ) : (
              <>
                <Link to="/register"><Button size="lg" variant="accent">Create Free Account</Button></Link>
                <Link to="/login"><Button size="lg" variant="secondary" className="bg-white/10 border-white/30 text-white hover:bg-white/20">Sign In</Button></Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;