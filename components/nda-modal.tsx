'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle } from 'lucide-react';

interface NdaModalProps {
  onAccept: () => void;
}

export function NdaModal({ onAccept }: NdaModalProps) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    // Check if user has already accepted NDA
    const hasAccepted = localStorage.getItem('meridian_nda_accepted');
    if (!hasAccepted) {
      setOpen(true);
    }
  }, []);

  const handleAccept = async () => {
    if (!accepted || !understood) {
      return;
    }

    try {
      // Record NDA acceptance in database
      const response = await fetch('/api/user/nda-acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedAt: new Date().toISOString(),
          version: '1.0',
        }),
      });

      if (response.ok) {
        localStorage.setItem('meridian_nda_accepted', 'true');
        setOpen(false);
        onAccept();
      }
    } catch (error) {
      console.error('Failed to record NDA acceptance:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-3xl border-primary/30 bg-[rgba(19,19,28,0.98)]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold">
              Non-Disclosure Agreement
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-muted-foreground">
            Please read and accept the following terms to continue using Meridian Dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-500/90">
              <p className="font-semibold mb-1">Important Legal Notice</p>
              <p>
                By accepting this agreement, you are legally bound to its terms. Violation may result in
                immediate account termination and legal action.
              </p>
            </div>
          </div>

          {/* NDA Content */}
          <ScrollArea className="h-[400px] rounded-lg border border-primary/20 bg-primary/5 p-6">
            <div className="space-y-6 text-sm text-muted-foreground">
              <section>
                <h3 className="text-base font-semibold text-foreground mb-3">
                  1. Confidential Information
                </h3>
                <p className="mb-3">
                  You acknowledge that Meridian's trading system, signals, strategies, algorithms, performance
                  data, and all related intellectual property (collectively, "Confidential Information") are
                  proprietary and confidential.
                </p>
                <p>
                  You agree not to disclose, copy, reproduce, or share any Confidential Information with any third
                  party without prior written consent from Meridian.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-foreground mb-3">2. Non-Compete</h3>
                <p className="mb-3">
                  During your subscription and for 12 months after termination, you agree not to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Develop, operate, or contribute to any competing algorithmic trading system that uses similar
                    methodologies to Meridian
                  </li>
                  <li>
                    Reverse engineer, decompile, or attempt to derive Meridian's trading logic or algorithms
                  </li>
                  <li>
                    Share Meridian's trade signals, entry/exit logic, or performance data with any competing service
                  </li>
                  <li>Use Confidential Information to create derivative works or competing products</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-foreground mb-3">3. Usage Restrictions</h3>
                <p className="mb-3">You agree to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Use Meridian signals exclusively for your personal trading accounts</li>
                  <li>Not redistribute, resell, or sublicense access to Meridian's signals or data</li>
                  <li>Not screenshot, record, or publicly share trade signals or system performance</li>
                  <li>Keep your account credentials secure and not share access with others</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-foreground mb-3">4. Intellectual Property</h3>
                <p>
                  All rights, title, and interest in Meridian's system, including but not limited to algorithms,
                  code, documentation, and performance data, remain the exclusive property of Meridian. This
                  agreement does not grant you any intellectual property rights.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-foreground mb-3">5. Remedies</h3>
                <p className="mb-3">You acknowledge that:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Breach of this agreement may cause irreparable harm to Meridian for which monetary damages may
                    be inadequate
                  </li>
                  <li>
                    Meridian is entitled to seek injunctive relief in addition to any other remedies available at
                    law or in equity
                  </li>
                  <li>Violation will result in immediate termination of your access without refund</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-foreground mb-3">6. Term and Survival</h3>
                <p>
                  This agreement remains in effect during your subscription and for 12 months after termination.
                  Sections 1 (Confidential Information), 2 (Non-Compete), 4 (Intellectual Property), and 5
                  (Remedies) survive termination.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-foreground mb-3">7. Governing Law</h3>
                <p>
                  This agreement is governed by the laws of California, United States, without regard to conflict of law
                  principles. You consent to exclusive jurisdiction in California state and federal courts.
                </p>
              </section>

              <p className="text-xs text-muted-foreground/70 mt-8 pt-6 border-t border-primary/10">
                Last Updated: March 10, 2026 • Version 1.0
              </p>
            </div>
          </ScrollArea>

          {/* Acceptance Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="accept-nda"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
                className="mt-1"
              />
              <label htmlFor="accept-nda" className="text-sm text-muted-foreground cursor-pointer">
                I have read and agree to the terms of this Non-Disclosure Agreement, including the confidentiality
                and non-compete obligations
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="understand-consequences"
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked === true)}
                className="mt-1"
              />
              <label htmlFor="understand-consequences" className="text-sm text-muted-foreground cursor-pointer">
                I understand that violation of this agreement may result in legal action and immediate account
                termination without refund
              </label>
            </div>
          </div>

          {/* Accept Button */}
          <Button
            onClick={handleAccept}
            disabled={!accepted || !understood}
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            {accepted && understood ? 'Accept and Continue' : 'Please accept both terms to continue'}
          </Button>

          <p className="text-xs text-center text-muted-foreground/70">
            By clicking "Accept and Continue", you electronically sign and agree to be bound by this agreement
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
