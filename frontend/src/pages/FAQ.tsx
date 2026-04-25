import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api, type FaqItem } from "@/lib/api";

export default function FAQ() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.faq.list()
      .then(setFaqs)
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-1">Perguntas Frequentes</h1>
          <p className="text-muted-foreground text-sm mb-10">Respostas às dúvidas mais comuns sobre o evento.</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[18px] border border-border/60 bg-white/96 overflow-hidden shadow-sm"
        >
          <Accordion type="single" collapsible className="divide-y divide-border">
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={`faq-${faq.id}`} className="border-none">
                <AccordionTrigger className="px-5 py-4 text-sm font-heading font-semibold hover:no-underline hover:bg-secondary/50 transition-colors">
                  <span className="flex items-center gap-2 text-left">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed pl-11">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
        )}
      </div>
    </div>
  );
}
