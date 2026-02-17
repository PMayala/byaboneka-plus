import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Mail, Phone, MapPin, MessageSquare, 
  ChevronDown, ChevronUp, HelpCircle, Send
} from 'lucide-react';
import { Button, Card, Input } from '../components/ui';
import { useRecaptcha } from '../hooks/useRecaptcha';
import api from '../services/api';
import toast from 'react-hot-toast';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'How do I report a lost item?',
    answer: 'Log in to your account and click "Report Lost Item" from the dashboard or navigation menu. Fill in the category, description, location area, date, and set verification questions that only the true owner would know. These questions are critical for proving ownership later.'
  },
  {
    question: 'How does the matching system work?',
    answer: 'Our algorithm compares your lost item report against all found items using multiple signals: matching categories, location proximity, time correlation, and keyword overlap in descriptions. Matches are scored from 0-13 and ranked so you see the most likely matches first.'
  },
  {
    question: 'What are verification questions?',
    answer: 'When reporting a lost item, you set 3 questions and answers that only the true owner would know — like "What is your phone\'s lock screen wallpaper?" or "How many cards are in the wallet?". When someone claims a matching found item, they must answer these correctly to prove ownership.'
  },
  {
    question: 'How does the OTP handover work?',
    answer: 'Once a claim is verified, the item owner generates a 6-digit OTP code from the platform. When meeting the finder for the physical handover, the owner shares this code with the finder who enters it on the platform. This confirms both parties were present and the item was exchanged.'
  },
  {
    question: 'What is the trust score?',
    answer: 'Your trust score starts at 5 and changes based on your behavior. Successfully returning items, completing handovers, and being a good community member increases it. Failed verifications, scam reports against you, and policy violations decrease it. Higher trust scores unlock more features.'
  },
  {
    question: 'How long before my item report expires?',
    answer: 'Lost items with status "Active" and found items with status "Unclaimed" automatically expire after 30 days of no updates. You\'ll receive a warning at 23 days. Pending claims expire after 7 days. You can always create a new report if needed.'
  },
  {
    question: 'What if someone falsely claims my item?',
    answer: 'The verification system protects you — claimants must correctly answer your verification questions. If they fail, the claim is rejected. If you believe there\'s an issue with a verified claim, you can open a dispute which will be reviewed by our administrators.'
  },
  {
    question: 'Can cooperatives use the platform?',
    answer: 'Yes! Transport cooperatives are key partners. Cooperative staff can register found items turned in by drivers, and the cooperative accountability leaderboard tracks performance. This creates transparency and incentivizes good behavior across Rwanda\'s transport ecosystem.'
  },
  {
    question: 'Is my personal information safe?',
    answer: 'Yes. Passwords are hashed with bcrypt, verification answers are stored securely, and our system automatically detects and redacts sensitive information like ID numbers and phone numbers from item descriptions. Your contact info is only shared with verified claimants.'
  },
  {
    question: 'Where should I meet for item handover?',
    answer: 'The platform recommends safe handover locations such as police stations, sector offices, and cooperative offices in your area. We strongly recommend using these locations rather than private meeting spots, especially for valuable items.'
  },
];

const ContactPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const { executeRecaptcha } = useRecaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha('contact');
      await api.post('/contact', {
        ...contactForm,
        ...(recaptchaToken && { recaptchaToken }),
      });
      toast.success('Message sent! We\'ll get back to you soon.');
      setContactForm({ name: '', email: '', message: '' });
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to send message. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Home
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Help & Contact</h1>
      <p className="text-gray-600 mb-8">Find answers to common questions or get in touch with us</p>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* FAQ Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-semibold text-gray-900">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <Card key={index} className="overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 text-gray-600 text-sm border-t border-gray-100 pt-3">
                    {faq.answer}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Contact Info & Form */}
        <div>
          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Contact Info</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-primary-500" />
                <a href="mailto:support@byaboneka.rw" className="hover:text-primary-500">mayalaplamedi.rw@gmail.com</a>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-primary-500" />
                <span>+250 785 368 349</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-primary-500" />
                <span>Kigali, Rwanda</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-900">Send Us a Message</h3>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="How can we help?"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>Sending...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Send Message</>
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;