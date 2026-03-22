"use client";
import { useState } from 'react';
import { XMarkIcon, ArrowLeftIcon, ArrowRightIcon, SparklesIcon, CheckCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import AITextarea from './AITextarea';

interface FocusArea {
  id: string;
  title: string;
  description: string;
  deadline: string;
  ongoing: boolean;
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: 'todo' | 'inprogress' | 'done';
}

interface ProjectVisionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  initialVision?: string;
  initialStrategy?: string;
  initialFocus?: string;
  initialFocusAreas?: FocusArea[];
  onSave: (data: { vision: string; strategy: string; focus: string; focusAreas?: FocusArea[] }) => void;
}

const STEPS = [
  {
    id: 'vision',
    title: '🔭 Vision: Your Destination',
    description: 'A Vision is the big, inspiring picture of the future you want to create. It\'s aspirational, long‑term, and emotional.',
    question: 'Where are we ultimately trying to go?',
    characteristics: [
      'Future‑oriented',
      'Motivational',
      'Broad and high‑level',
      'Not tied to specific actions or timelines'
    ],
    example: '"Create a seamless digital experience that empowers every customer to manage their finances with confidence."',
    placeholder: 'Describe the inspiring future you want this project to create...',
    aiPrompt: 'vision statement'
  },
  {
    id: 'strategy',
    title: '🧭 Strategy: Your Route to Get There',
    description: 'Strategy is the overarching approach you\'ll take to move toward your Vision. It\'s about choices, priorities, and the logic behind how you\'ll win or succeed.',
    question: 'How will we get there?',
    characteristics: [
      'Medium to long‑term',
      'Defines the path, not the steps',
      'Involves trade‑offs and prioritisation',
      'Connects the Vision to actionable plans'
    ],
    example: '"Leverage automation and data insights to simplify customer workflows, reduce friction, and personalise financial guidance."',
    placeholder: 'Describe the approach and key choices that will move you toward your vision...',
    aiPrompt: 'strategy statement'
  },
  {
    id: 'focus',
    title: '🎯 Focus: Your Priorities Right Now',
    description: 'Focus is what you choose to concentrate on in the near term. It\'s tactical, grounded, and practical.',
    question: 'What matters most right now?',
    characteristics: [
      'Short‑term',
      'Specific and actionable',
      'Helps teams avoid distraction',
      'Changes as conditions change'
    ],
    example: '"Improve onboarding flow and reduce customer setup time by 30% this quarter."',
    placeholder: 'Define your immediate priorities and what you\'ll focus on in the short term...',
    aiPrompt: 'focus statement'
  },
  {
    id: 'tasks',
    title: '📋 Focus Areas & Tasks (Optional)',
    description: 'Break down your focus into actionable areas and specific tasks. You can add these now or skip and add them later.',
    question: 'What are the key areas and tasks to execute your focus?',
    characteristics: [
      'Organized by focus area',
      'Specific, actionable tasks',
      'Include start and end dates',
      'Can be assigned to team members'
    ],
    example: 'Focus Area: "User Onboarding" with tasks like "Design welcome screen", "Build tutorial flow", "Add skip option"',
    placeholder: '',
    aiPrompt: ''
  }
];

function randomId() {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) 
    return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2, 11);
}

export default function ProjectVisionWizard({
  isOpen,
  onClose,
  projectName,
  initialVision = '',
  initialStrategy = '',
  initialFocus = '',
  initialFocusAreas = [],
  onSave
}: ProjectVisionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [vision, setVision] = useState(initialVision);
  const [strategy, setStrategy] = useState(initialStrategy);
  const [focus, setFocus] = useState(initialFocus);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(initialFocusAreas);
  const [showReview, setShowReview] = useState(false);

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  
  const getCurrentValue = () => {
    switch (step.id) {
      case 'vision': return vision;
      case 'strategy': return strategy;
      case 'focus': return focus;
      default: return '';
    }
  };

  const setCurrentValue = (value: string) => {
    switch (step.id) {
      case 'vision': setVision(value); break;
      case 'strategy': setStrategy(value); break;
      case 'focus': setFocus(value); break;
    }
  };

  const canProceed = step.id === 'tasks' ? true : getCurrentValue().trim().length > 20;

  const addFocusArea = () => {
    setFocusAreas([...focusAreas, {
      id: randomId(),
      title: '',
      description: '',
      deadline: '',
      ongoing: false,
      tasks: []
    }]);
  };

  const removeFocusArea = (index: number) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
  };

  const updateFocusArea = (index: number, field: keyof FocusArea, value: any) => {
    const updated = [...focusAreas];
    updated[index] = { ...updated[index], [field]: value };
    setFocusAreas(updated);
  };

  const addTask = (areaIndex: number) => {
    const updated = [...focusAreas];
    updated[areaIndex].tasks.push({
      id: randomId(),
      title: '',
      startDate: '',
      endDate: '',
      status: 'todo'
    });
    setFocusAreas(updated);
  };

  const removeTask = (areaIndex: number, taskIndex: number) => {
    const updated = [...focusAreas];
    updated[areaIndex].tasks = updated[areaIndex].tasks.filter((_, i) => i !== taskIndex);
    setFocusAreas(updated);
  };

  const updateTask = (areaIndex: number, taskIndex: number, field: keyof Task, value: any) => {
    const updated = [...focusAreas];
    updated[areaIndex].tasks[taskIndex] = { ...updated[areaIndex].tasks[taskIndex], [field]: value };
    setFocusAreas(updated);
  };

  const handleNext = () => {
    if (isLastStep) {
      setShowReview(true);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (showReview) {
      setShowReview(false);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSave = () => {
    // Filter out empty focus areas and tasks
    const cleanedFocusAreas = focusAreas
      .filter(fa => fa.title.trim())
      .map(fa => ({
        ...fa,
        tasks: fa.tasks.filter(t => t.title.trim())
      }));
    
    onSave({ 
      vision, 
      strategy, 
      focus,
      focusAreas: cleanedFocusAreas.length > 0 ? cleanedFocusAreas : undefined
    });
    onClose();
  };

  const handleSkipTasks = () => {
    setShowReview(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Project Planning Wizard</h2>
            <p className="text-sm text-white/90">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-100 px-6 py-3 flex items-center gap-2">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition ${
                idx < currentStep
                  ? 'bg-green-500 text-white'
                  : idx === currentStep && !showReview
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-300 text-gray-600'
              }`}>
                {idx < currentStep ? <CheckCircleIcon className="w-5 h-5" /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded transition ${
                  idx < currentStep ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showReview ? (
            <div className="space-y-6">
              {/* Step Title */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-700 text-lg">{step.description}</p>
              </div>

              {/* Key Question */}
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
                <p className="font-semibold text-orange-900">
                  <span className="text-orange-600">Key Question:</span> "{step.question}"
                </p>
              </div>

              {/* Characteristics */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Characteristics:</h4>
                <ul className="grid grid-cols-2 gap-2">
                  {step.characteristics.map((char, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-orange-500 mt-1">•</span>
                      <span>{char}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Example */}
              {step.id !== 'tasks' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-1">Example:</p>
                  <p className="text-blue-800 italic">{step.example}</p>
                </div>
              )}

              {/* Input Area - Text Statements */}
              {step.id !== 'tasks' && (
                <div>
                  <label className="block font-semibold text-gray-900 mb-2">
                    Your {step.title.split(':')[0]} Statement
                  </label>
                  <AITextarea
                    value={getCurrentValue()}
                    onChange={setCurrentValue}
                    placeholder={step.placeholder}
                    rows={6}
                    aiContext={`Improve this project ${step.aiPrompt} for "${projectName}". Make it inspiring, clear, and aligned with best practices for ${step.id} statements.`}
                  />
                  {getCurrentValue().trim() && getCurrentValue().trim().length < 20 && (
                    <p className="text-sm text-amber-600 mt-2">
                      Your {step.id} statement should be at least 20 characters to capture the essence properly.
                    </p>
                  )}
                </div>
              )}

              {/* Input Area - Tasks & Focus Areas */}
              {step.id === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Add focus areas and specific tasks to organize your work. This is optional—you can skip and add them later.
                    </p>
                    <button
                      onClick={addFocusArea}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium text-sm whitespace-nowrap"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Focus Area
                    </button>
                  </div>

                  {focusAreas.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <p className="text-gray-500 mb-4">No focus areas yet</p>
                      <button
                        onClick={addFocusArea}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
                      >
                        <PlusIcon className="w-5 h-5" />
                        Add Your First Focus Area
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {focusAreas.map((area, areaIdx) => (
                        <div key={area.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <input
                              type="text"
                              value={area.title}
                              onChange={(e) => updateFocusArea(areaIdx, 'title', e.target.value)}
                              placeholder="Focus Area Title (e.g., User Onboarding)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
                            />
                            <button
                              onClick={() => removeFocusArea(areaIdx)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Remove focus area"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>

                          <textarea
                            value={area.description}
                            onChange={(e) => updateFocusArea(areaIdx, 'description', e.target.value)}
                            placeholder="Brief description of this focus area"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
                            rows={2}
                          />

                          <div className="flex items-center gap-4 mb-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={area.ongoing}
                                onChange={(e) => updateFocusArea(areaIdx, 'ongoing', e.target.checked)}
                                className="rounded"
                              />
                              <span className="text-gray-700">Ongoing</span>
                            </label>
                            {!area.ongoing && (
                              <input
                                type="date"
                                value={area.deadline}
                                onChange={(e) => updateFocusArea(areaIdx, 'deadline', e.target.value)}
                                className="px-3 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Deadline"
                              />
                            )}
                          </div>

                          {/* Tasks */}
                          <div className="ml-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-700">Tasks:</p>
                              <button
                                onClick={() => addTask(areaIdx)}
                                className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                              >
                                <PlusIcon className="w-4 h-4" />
                                Add Task
                              </button>
                            </div>

                            {area.tasks.length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No tasks yet</p>
                            ) : (
                              area.tasks.map((task, taskIdx) => (
                                <div key={task.id} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                                  <input
                                    type="text"
                                    value={task.title}
                                    onChange={(e) => updateTask(areaIdx, taskIdx, 'title', e.target.value)}
                                    placeholder="Task title"
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <input
                                    type="date"
                                    value={task.startDate}
                                    onChange={(e) => updateTask(areaIdx, taskIdx, 'startDate', e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-xs w-32"
                                    placeholder="Start"
                                  />
                                  <input
                                    type="date"
                                    value={task.endDate}
                                    onChange={(e) => updateTask(areaIdx, taskIdx, 'endDate', e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-xs w-32"
                                    placeholder="End"
                                  />
                                  <button
                                    onClick={() => removeTask(areaIdx, taskIdx)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Review Section
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">✅ Review Your Planning Framework</h3>
                <p className="text-gray-700">Review your Vision, Strategy, and Focus statements below. You can go back to edit any section if needed.</p>
              </div>

              {/* Summary Table */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🔭</span>
                    <h4 className="font-bold text-gray-900">Vision</h4>
                    <span className="text-sm text-gray-500">(Where are we going?)</span>
                  </div>
                  <p className="text-gray-800 italic pl-8">{vision || '(Not set)'}</p>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🧭</span>
                    <h4 className="font-bold text-gray-900">Strategy</h4>
                    <span className="text-sm text-gray-500">(How will we get there?)</span>
                  </div>
                  <p className="text-gray-800 italic pl-8">{strategy || '(Not set)'}</p>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🎯</span>
                    <h4 className="font-bold text-gray-900">Focus</h4>
                    <span className="text-sm text-gray-500">(What matters most right now?)</span>
                  </div>
                  <p className="text-gray-800 italic pl-8">{focus || '(Not set)'}</p>
                </div>

                {focusAreas.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">📋</span>
                      <h4 className="font-bold text-gray-900">Focus Areas</h4>
                      <span className="text-sm text-gray-500">({focusAreas.length} area{focusAreas.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="pl-8 space-y-3">
                      {focusAreas.map((area, idx) => (
                        <div key={area.id} className="bg-white rounded border border-gray-200 p-3">
                          <p className="font-semibold text-gray-900">{area.title || '(Untitled)'}</p>
                          {area.description && (
                            <p className="text-sm text-gray-600 mt-1">{area.description}</p>
                          )}
                          {area.tasks.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              {area.tasks.length} task{area.tasks.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-900">
                  <span className="font-semibold">Next steps:</span> {focusAreas.length > 0 
                    ? 'Your planning framework is complete! After saving, you can refine tasks, assign team members, and add resources.'
                    : 'After saving, you can add focus areas, tasks, milestones, and SMART goals to your project plan.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleBack}
            disabled={currentStep === 0 && !showReview}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {!showReview ? (
              <>
                {step.id === 'tasks' && (
                  <button
                    onClick={handleSkipTasks}
                    className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-200 transition"
                  >
                    Skip for Now
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={!canProceed}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLastStep ? 'Review' : 'Next'}
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 transition"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Save to Project Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
