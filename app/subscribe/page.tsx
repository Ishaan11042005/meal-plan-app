// app/subscribe/page.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { availablePlans, Plan } from "@/lib/plans"; // Adjust the path based on your project structure
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast"; // Optional: For better user feedback

// Define the shape of the successful response
type SubscribeResponse = {
  url: string;
};

// Define the shape of the error response
type SubscribeError = {
  error: string;
};

// API call function to subscribe to a plan
const subscribeToPlan = async ({
  planType,
  userId,
  email,
}: {
  planType: string;
  userId: string;
  email: string;
}): Promise<SubscribeResponse> => {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planType,
      userId,
      email,
    }),
  });

  if (!res.ok) {
    const errorData: SubscribeError = await res.json();
    throw new Error(errorData.error || "Something went wrong.");
  }

  const data: SubscribeResponse = await res.json();
  return data;
};

export default function SubscribePage() {
  const { user } = useUser(); // Access the current user
  const router = useRouter(); // Next.js router for navigation
  const queryClient = useQueryClient();

  const userId = user?.id;
  const email = user?.emailAddresses?.[0]?.emailAddress || "";

  // React Query's useMutation hook for handling the subscription process
  const mutation = useMutation<SubscribeResponse, Error, { planType: string }>({
    mutationFn: async ({ planType }) => {
      if (!userId) {
        throw new Error("User not signed in.");
      }

      return subscribeToPlan({ planType, userId, email });
    },
    onMutate: () => {
      // Optional: Show a loading toast or similar feedback
      toast.loading("Processing your subscription...", { id: "subscribe" });
    },
    onSuccess: (data) => {
      // Update the toast to success
      toast.success("Redirecting to checkout!", { id: "subscribe" });
      // Redirect to the Stripe Checkout URL
      window.location.href = data.url;
    },
    onError: (error) => {
      // Update the toast to show an error
      toast.error(error.message || "Something went wrong.", {
        id: "subscribe",
      });
    },
  });

  // Handler for subscribing to a plan
  const handleSubscribe = (planType: string) => {
    if (!userId) {
      // Redirect to sign-up if the user is not signed in
      router.push("/sign-up");
      return;
    }

    // Trigger the mutation
    mutation.mutate({ planType });
  };

  return (
    <div className="px-4 py-8 sm:py-12 lg:py-16">
      <Toaster position="top-right" /> {/* Optional: For toast notifications */}
      {/* Section Header */}
      <div>
        <h2 className="text-3xl font-bold text-center mt-12 sm:text-5xl tracking-tight">
          Pricing
        </h2>
        <p className="max-w-3xl mx-auto mt-4 text-xl text-center">
          Get started on our weekly plan or upgrade to monthly or yearly when
          you’re ready.
        </p>
      </div>
      {/* Cards Container */}
      <div className="mt-12 container mx-auto space-y-12 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-x-8">
        {/* Map over availablePlans to render plan cards */}
        {availablePlans.map((plan, key) => (
          <div
            key={key}
            className="
              relative p-8 
              border border-gray-200 rounded-2xl shadow-sm 
              flex flex-col
              hover:shadow-md hover:scale-[1.02] 
              transition-transform duration-200 ease-out
            "
          >
            <div className="flex-1">
              {/* Conditionally render "Most popular" label */}
              {plan.isPopular && (
                <p className="absolute top-0 py-1.5 px-4 bg-emerald-500 text-white rounded-full text-xs font-semibold uppercase tracking-wide transform -translate-y-1/2">
                  Most popular
                </p>
              )}
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="mt-4 flex items-baseline">
                <span className="text-5xl font-extrabold tracking-tight">
                  ${plan.amount}
                </span>
                <span className="ml-1 text-xl font-semibold">
                  /{plan.interval}
                </span>
              </p>
              <p className="mt-6">{plan.description}</p>
              <ul role="list" className="mt-6 space-y-4">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0 w-6 h-6 text-emerald-500"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="ml-3">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              className={`${
                plan.interval === "month"
                  ? "bg-emerald-500 text-white  hover:bg-emerald-600 "
                  : "bg-emerald-100 text-emerald-700  hover:bg-emerald-200 "
              }  mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium disabled:bg-gray-400 disabled:cursor-not-allowed`}
              onClick={() => handleSubscribe(plan.interval)}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Please wait..." : `Subscribe ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
