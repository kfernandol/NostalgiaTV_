using ApplicationCore.DTOs.Episode;
using FluentValidation;

namespace WebApi.Validators
{
    public class EpisodeRequestValidator : AbstractValidator<EpisodeRequest>
    {
        public EpisodeRequestValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(100);
            RuleFor(x => x.FilePath).NotEmpty();
            RuleFor(x => x.Order).GreaterThan(0);
            RuleFor(x => x.SeriesId).GreaterThan(0);
        }
    }
}
